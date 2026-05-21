using Damafon.API.Hubs;
using Damafon.API.Models;
using Damafon.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Damafon.API.Controllers;

/// <summary>
/// Hikvision qurilmadan kelgan HTTP push eventlarini qabul qiladi.
///
/// Hikvision admin panelida sozlash:
///   Configuration → Network → Advanced → Integration Protocol
///     HTTP Listening → URL: http://SERVER:5050/api/hikvision/{deviceId}/event
///
/// Device id ni Damafon UI da qurilma qo'shgandan so'ng ko'rasiz.
/// </summary>
[ApiController]
[Route("api/hikvision")]
public class HikvisionEventController : ControllerBase
{
    private readonly IDeviceService _devices;
    private readonly ICallSessionService _sessions;
    private readonly IHubContext<IntercomHub> _hub;
    private readonly ILogger<HikvisionEventController> _logger;

    public HikvisionEventController(
        IDeviceService devices,
        ICallSessionService sessions,
        IHubContext<IntercomHub> hub,
        ILogger<HikvisionEventController> logger)
    {
        _devices = devices;
        _sessions = sessions;
        _hub = hub;
        _logger = logger;
    }

    /// <summary>
    /// Hikvision bu endpoint ga POST/GET yuboradi — qo'ng'iroq boshlanganda.
    /// Body mazmuni muhim emas (XML yoki bo'sh bo'lishi mumkin).
    /// </summary>
    [HttpPost("{deviceId}/event")]
    [HttpGet("{deviceId}/event")]
    public async Task<IActionResult> IncomingCall(string deviceId, CancellationToken ct)
    {
        var device = _devices.GetById(deviceId);
        if (device == null || !device.Enabled)
        {
            _logger.LogWarning("Hikvision event: device {Id} topilmadi yoki o'chirilgan", deviceId);
            return NotFound();
        }

        // Bir xil qurilmadan takroriy event kelsa e'tiborsiz qoldiramiz
        var alreadyRinging = _sessions.GetActiveSessions()
            .Any(s => s.DeviceId == deviceId && s.Status == CallStatus.Ringing);

        if (alreadyRinging)
        {
            _logger.LogDebug("Hikvision {Name}: takroriy event, e'tiborsiz", device.Name);
            return Ok();
        }

        // SIP yo'q — Asterisk channel ID o'rniga o'z ID ni yaratamiz
        var channelId = $"hik-{deviceId}-{Guid.NewGuid():N}"[..32];

        var session = new CallSession
        {
            ChannelId = channelId,
            CallerId = device.HttpHost,
            DeviceId = device.Id,
            DeviceName = device.Name,
            Status = CallStatus.Ringing,
            StartedAt = DateTime.UtcNow,
            SipEnabled = false,   // go2rtc RTSP backchannel ishlatiladi, Asterisk emas
        };
        _sessions.AddSession(session);

        _logger.LogInformation("Hikvision qo'ng'iroq: {Name} ({Host}), channelId={Id}",
            device.Name, device.HttpHost, channelId);

        await _hub.Clients.All.SendAsync("IncomingCall",
            new IncomingCallDto(channelId, device.HttpHost, device.Id, device.Name, session.StartedAt, false),
            ct);

        // 90 soniya ichida javob berilmasa sessiyani avtomatik yopamiz
        _ = AutoExpireAsync(channelId, device.Name);

        return Ok();
    }

    /// <summary>
    /// Hikvision ba'zi modellarda server mavjudligini tekshirish uchun GET yuboradi.
    /// 200 OK qaytarish yetarli.
    /// </summary>
    [HttpGet("{deviceId}/ping")]
    [HttpPost("{deviceId}/ping")]
    public IActionResult Ping(string deviceId) => Ok(new { ok = true, deviceId });

    private async Task AutoExpireAsync(string channelId, string deviceName)
    {
        await Task.Delay(TimeSpan.FromSeconds(90));
        var session = _sessions.GetSession(channelId);
        if (session?.Status != CallStatus.Ringing) return;

        _sessions.RemoveSession(channelId);
        _logger.LogInformation("Hikvision {Name}: javob berilmadi, sessiya yopildi", deviceName);
        await _hub.Clients.All.SendAsync("CallEnded", new CallEndedDto(channelId, "timeout"));
    }
}
