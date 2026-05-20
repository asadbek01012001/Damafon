using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Damafon.API.Hubs;
using Damafon.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Damafon.API.Services;

public class AriService : BackgroundService
{
    private readonly ILogger<AriService> _logger;
    private readonly IConfiguration _config;
    private readonly IHubContext<IntercomHub> _hub;
    private readonly ICallSessionService _sessions;
    private readonly IDeviceService _devices;
    private readonly IAriRestClient _ari;
    private readonly string _wsUrl;
    private const int ReconnectDelayMs = 5000;

    public AriService(
        ILogger<AriService> logger,
        IConfiguration config,
        IHubContext<IntercomHub> hub,
        ICallSessionService sessions,
        IDeviceService devices,
        IAriRestClient ari)
    {
        _logger = logger;
        _config = config;
        _hub = hub;
        _sessions = sessions;
        _devices = devices;
        _ari = ari;

        var host = config["Asterisk:Host"] ?? "localhost";
        var port = config["Asterisk:AriPort"] ?? "8088";
        var user = config["Asterisk:AriUsername"] ?? "ari_user";
        var pass = config["Asterisk:AriPassword"] ?? "";
        var app = config["Asterisk:AppName"] ?? "intercom";

        _wsUrl = $"ws://{host}:{port}/ari/events?api_key={user}:{pass}&app={app}&subscribeAll=false";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ARI service starting...");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConnectAndListenAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ARI connection failed, retrying in {Delay}ms", ReconnectDelayMs);
                await Task.Delay(ReconnectDelayMs, stoppingToken);
            }
        }
        _logger.LogInformation("ARI service stopped.");
    }

    private async Task ConnectAndListenAsync(CancellationToken ct)
    {
        using var ws = new ClientWebSocket();
        _logger.LogInformation("Connecting to Asterisk ARI: {Url}", _wsUrl);
        await ws.ConnectAsync(new Uri(_wsUrl), ct);
        _logger.LogInformation("Connected to Asterisk ARI WebSocket");

        var buffer = new byte[65536];
        var msgBuilder = new StringBuilder();

        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            msgBuilder.Clear();
            WebSocketReceiveResult result;
            do
            {
                result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogWarning("ARI WebSocket closed by server");
                    return;
                }
                msgBuilder.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            } while (!result.EndOfMessage);

            _ = Task.Run(() => HandleEventAsync(msgBuilder.ToString()), ct);
        }
    }

    private async Task HandleEventAsync(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var eventType = typeProp.GetString();

            _logger.LogDebug("ARI event: {Type}", eventType);

            switch (eventType)
            {
                case "StasisStart":
                    await OnStasisStartAsync(root);
                    break;
                case "StasisEnd":
                    await OnStasisEndAsync(root);
                    break;
                case "ChannelHangupRequest":
                    await OnHangupRequestAsync(root);
                    break;
                case "ChannelStateChange":
                    await OnStateChangeAsync(root);
                    break;
                case "ChannelEnteredBridge":
                    _logger.LogInformation("Channel entered bridge");
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing ARI event");
        }
    }

    private async Task OnStasisStartAsync(JsonElement root)
    {
        var channel = root.GetProperty("channel");
        var channelId = channel.GetProperty("id").GetString()!;
        var callerNum = channel.GetProperty("caller").GetProperty("number").GetString() ?? "unknown";

        // Webphone kanali (biz originate qilgan) — bridge ga qo'shamiz
        var bridgeSession = _sessions.FindByWebphoneChannelId(channelId);
        if (bridgeSession != null)
        {
            try
            {
                await _ari.AddChannelToBridgeAsync(bridgeSession.BridgeId!, channelId);
                bridgeSession.Status = CallStatus.Answered;
                bridgeSession.AnsweredAt = DateTime.UtcNow;
                _logger.LogInformation("Webphone channel {ChannelId} bridged to {BridgeId}", channelId, bridgeSession.BridgeId);
                await _hub.Clients.All.SendAsync("CallAnswered",
                    new CallAnsweredDto(bridgeSession.ChannelId, bridgeSession.AnsweredAt.Value));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to bridge webphone channel {ChannelId}", channelId);
            }
            return;
        }

        // Dahua / Hikvision — kiruvchi chaqiruv
        var device = _devices.FindBySipCallerId(callerNum);
        var sipEnabled = device?.SipEnabled ?? true;
        var session = new CallSession
        {
            ChannelId = channelId,
            CallerId = callerNum,
            DeviceId = device?.Id,
            DeviceName = device?.Name,
            Status = CallStatus.Ringing,
            StartedAt = DateTime.UtcNow,
            SipEnabled = sipEnabled
        };
        _sessions.AddSession(session);

        _logger.LogInformation("Incoming call from {Caller} (device: {Device}), channelId={ChannelId}",
            callerNum, device?.Name ?? "unknown", channelId);

        await _hub.Clients.All.SendAsync("IncomingCall",
            new IncomingCallDto(channelId, callerNum, device?.Id, device?.Name, session.StartedAt, sipEnabled));
    }

    private async Task OnStasisEndAsync(JsonElement root)
    {
        var channelId = root.GetProperty("channel").GetProperty("id").GetString()!;

        // Asosiy kanal (Dahua/Hikvision) tugatildi
        var session = _sessions.GetSession(channelId);
        if (session != null)
        {
            _sessions.RemoveSession(channelId);
            if (session.WebphoneChannelId != null)
                try { await _ari.HangupChannelAsync(session.WebphoneChannelId); } catch { }
            _logger.LogInformation("Main call ended: {ChannelId}", channelId);
            await _hub.Clients.All.SendAsync("CallEnded", new CallEndedDto(channelId, "normal"));
            return;
        }

        // Webphone kanali tugatildi — asosiy chaqiruvni ham yakunlaymiz
        var bridgeSession = _sessions.FindByWebphoneChannelId(channelId);
        if (bridgeSession != null)
        {
            _sessions.RemoveSession(bridgeSession.ChannelId);
            try { await _ari.HangupChannelAsync(bridgeSession.ChannelId); } catch { }
            _logger.LogInformation("Webphone ended, closing call: {ChannelId}", bridgeSession.ChannelId);
            await _hub.Clients.All.SendAsync("CallEnded", new CallEndedDto(bridgeSession.ChannelId, "normal"));
        }
    }

    private async Task OnHangupRequestAsync(JsonElement root)
    {
        var channelId = root.GetProperty("channel").GetProperty("id").GetString()!;

        var session = _sessions.GetSession(channelId);
        if (session != null)
        {
            _sessions.RemoveSession(channelId);
            if (session.WebphoneChannelId != null)
                try { await _ari.HangupChannelAsync(session.WebphoneChannelId); } catch { }
            await _hub.Clients.All.SendAsync("CallEnded", new CallEndedDto(channelId, "hangup"));
            return;
        }

        var bridgeSession = _sessions.FindByWebphoneChannelId(channelId);
        if (bridgeSession != null)
        {
            _sessions.RemoveSession(bridgeSession.ChannelId);
            try { await _ari.HangupChannelAsync(bridgeSession.ChannelId); } catch { }
            await _hub.Clients.All.SendAsync("CallEnded", new CallEndedDto(bridgeSession.ChannelId, "hangup"));
        }
    }

    private Task OnStateChangeAsync(JsonElement root)
    {
        var channel = root.GetProperty("channel");
        var channelId = channel.GetProperty("id").GetString()!;
        var state = channel.GetProperty("state").GetString();
        var session = _sessions.GetSession(channelId);
        if (session != null && state == "Up" && session.Status == CallStatus.Ringing)
        {
            session.Status = CallStatus.Answered;
            session.AnsweredAt = DateTime.UtcNow;
        }
        return Task.CompletedTask;
    }
}
