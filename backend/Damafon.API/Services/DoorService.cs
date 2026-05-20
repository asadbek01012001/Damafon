using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Damafon.API.Models;

namespace Damafon.API.Services;

public interface IDoorService
{
    Task<bool> OpenDoorAsync(CancellationToken ct = default);
    Task<bool> OpenDoorAsync(Device device, CancellationToken ct = default);
}

public class DoorService : IDoorService
{
    private readonly IHttpClientFactory _factory;
    private readonly IConfiguration _config;
    private readonly ILogger<DoorService> _logger;

    public DoorService(IHttpClientFactory factory, IConfiguration config, ILogger<DoorService> logger)
    {
        _factory = factory;
        _config = config;
        _logger = logger;
    }

    public Task<bool> OpenDoorAsync(CancellationToken ct = default)
    {
        var device = new Device
        {
            Brand = DeviceBrand.Dahua,
            HttpHost = _config["Dahua:Host"] ?? "192.168.1.100",
            HttpPort = int.TryParse(_config["Dahua:Port"], out var p) ? p : 80,
            HttpUsername = _config["Dahua:Username"] ?? "admin",
            HttpPassword = _config["Dahua:Password"] ?? "admin123",
            HttpChannel = int.TryParse(_config["Dahua:Channel"], out var c) ? c : 1,
        };
        return OpenDoorAsync(device, ct);
    }

    public async Task<bool> OpenDoorAsync(Device device, CancellationToken ct = default)
    {
        return device.Brand switch
        {
            DeviceBrand.Hikvision => await OpenHikvisionDoor(device, ct),
            _ => await OpenDahuaDoor(device, ct),
        };
    }

    private async Task<bool> OpenDahuaDoor(Device device, CancellationToken ct)
    {
        // Dahua HTTP CGI API
        var url = $"http://{device.HttpHost}:{device.HttpPort}/cgi-bin/accessControl.cgi" +
                  $"?action=openDoor&channel={device.HttpChannel}&Type=Remote&UserID=101&Door=1";
        try
        {
            using var http = CreateDigestClient(device.HttpUsername, device.HttpPassword);
            var resp = await http.GetAsync(url, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            var ok = resp.IsSuccessStatusCode && body.Contains("OK");
            _logger.LogInformation("Dahua door [{Host}]: {Result}", device.HttpHost, ok ? "OK" : "FAIL");
            return ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dahua door open failed [{Host}]", device.HttpHost);
            return false;
        }
    }

    private async Task<bool> OpenHikvisionDoor(Device device, CancellationToken ct)
    {
        // Hikvision ISAPI — Digest auth talab qiladi
        var url = $"http://{device.HttpHost}:{device.HttpPort}" +
                  $"/ISAPI/AccessControl/RemoteControl/door/{device.HttpChannel}";

        var xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <RemoteControlDoor>
              <cmd>open</cmd>
            </RemoteControlDoor>
            """;

        try
        {
            using var http = CreateDigestClient(device.HttpUsername, device.HttpPassword);
            var content = new StringContent(xml, Encoding.UTF8, "application/xml");
            var resp = await http.PutAsync(url, content, ct);
            var ok = resp.IsSuccessStatusCode;
            _logger.LogInformation("Hikvision door [{Host}]: {Status}", device.HttpHost, resp.StatusCode);
            return ok;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Hikvision door open failed [{Host}]", device.HttpHost);
            return false;
        }
    }

    private static HttpClient CreateDigestClient(string username, string password)
    {
        var handler = new HttpClientHandler
        {
            Credentials = new NetworkCredential(username, password),
            PreAuthenticate = false,
        };
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(8) };
        // Force TCP connection close so Dahua frees the slot immediately;
        // without this, the device rejects the next request while the old socket is in TIME_WAIT.
        client.DefaultRequestHeaders.ConnectionClose = true;
        return client;
    }

    // Dahua uchun Basic auth
    private HttpClient CreateClient(string username, string password)
    {
        var http = _factory.CreateClient();
        var encoded = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{username}:{password}"));
        http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Basic", encoded);
        http.Timeout = TimeSpan.FromSeconds(5);
        return http;
    }
}
