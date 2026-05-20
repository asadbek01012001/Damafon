using Damafon.API.Models;

namespace Damafon.API.Services;

public interface IGo2rtcService
{
    Task AddStreamAsync(Device device, CancellationToken ct = default);
    Task RemoveStreamAsync(string deviceId, CancellationToken ct = default);
    string GetStreamName(string deviceId) => $"device_{deviceId}";
}

public class Go2rtcService : IGo2rtcService
{
    private readonly IHttpClientFactory _factory;
    private readonly string _baseUrl;
    private readonly ILogger<Go2rtcService> _logger;

    public Go2rtcService(IHttpClientFactory factory, IConfiguration config, ILogger<Go2rtcService> logger)
    {
        _factory = factory;
        _logger = logger;
        _baseUrl = config["Go2rtc:BaseUrl"] ?? "http://go2rtc:1984";
    }

    private static string BuildRtspUrl(Device device)
    {
        var user = Uri.EscapeDataString(device.RtspUsername ?? "");
        var pass = Uri.EscapeDataString(device.RtspPassword ?? "");
        var host = $"{device.RtspHost}:{device.RtspPort}";

        return device.Brand switch
        {
            DeviceBrand.Hikvision =>
                $"rtsp://{user}:{pass}@{host}/Streaming/Channels/{device.RtspChannel}02",

            _ => $"rtsp://{user}:{pass}@{host}/cam/realmonitor?channel={device.RtspChannel}&subtype=1",
        };
    }

    public async Task AddStreamAsync(Device device, CancellationToken ct = default)
    {
        var rtsp = BuildRtspUrl(device);

        var streamName = ((IGo2rtcService)this).GetStreamName(device.Id);
        var url = $"{_baseUrl}/api/streams?name={streamName}&src={Uri.EscapeDataString(rtsp)}";

        try
        {
            using var http = _factory.CreateClient();
            var resp = await http.PutAsync(url, null, ct);
            _logger.LogInformation("go2rtc stream '{Name}' added: {Status}", streamName, resp.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add go2rtc stream for device {Id}", device.Id);
        }
    }

    public async Task RemoveStreamAsync(string deviceId, CancellationToken ct = default)
    {
        var streamName = ((IGo2rtcService)this).GetStreamName(deviceId);
        var url = $"{_baseUrl}/api/streams?name={streamName}";

        try
        {
            using var http = _factory.CreateClient();
            await http.DeleteAsync(url, ct);
            _logger.LogInformation("go2rtc stream '{Name}' removed", streamName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove go2rtc stream {Name}", streamName);
        }
    }
}
