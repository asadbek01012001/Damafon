using System.Text;
using System.Text.Json;

namespace Damafon.API.Services;

public interface IAriRestClient
{
    Task AnswerChannelAsync(string channelId, CancellationToken ct = default);
    Task HangupChannelAsync(string channelId, string reason = "normal", CancellationToken ct = default);
    Task<string> CreateBridgeAsync(CancellationToken ct = default);
    Task AddChannelToBridgeAsync(string bridgeId, string channelId, CancellationToken ct = default);
    Task<string> OriginateToAppAsync(string endpoint, string app, CancellationToken ct = default);
}

public class AriRestClient : IAriRestClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly ILogger<AriRestClient> _logger;

    public AriRestClient(IHttpClientFactory factory, IConfiguration config, ILogger<AriRestClient> logger)
    {
        _logger = logger;
        _http = factory.CreateClient();

        var host = config["Asterisk:Host"] ?? "localhost";
        var port = config["Asterisk:AriPort"] ?? "8088";
        var user = config["Asterisk:AriUsername"] ?? "ari_user";
        var pass = config["Asterisk:AriPassword"] ?? "";

        _baseUrl = $"http://{host}:{port}/ari";

        var encoded = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{user}:{pass}"));
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", encoded);
    }

    public async Task AnswerChannelAsync(string channelId, CancellationToken ct = default)
    {
        var resp = await _http.PostAsync($"{_baseUrl}/channels/{channelId}/answer", null, ct);
        resp.EnsureSuccessStatusCode();
        _logger.LogInformation("Answered channel {ChannelId}", channelId);
    }

    public async Task HangupChannelAsync(string channelId, string reason = "normal", CancellationToken ct = default)
    {
        var resp = await _http.DeleteAsync($"{_baseUrl}/channels/{channelId}?reason={reason}", ct);
        if (!resp.IsSuccessStatusCode)
            _logger.LogWarning("Hangup returned {Status} for channel {ChannelId}", resp.StatusCode, channelId);
    }

    public async Task<string> CreateBridgeAsync(CancellationToken ct = default)
    {
        var resp = await _http.PostAsync($"{_baseUrl}/bridges?type=mixing", null, ct);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        var bridgeId = doc.RootElement.GetProperty("id").GetString()!;
        _logger.LogInformation("Created bridge {BridgeId}", bridgeId);
        return bridgeId;
    }

    public async Task AddChannelToBridgeAsync(string bridgeId, string channelId, CancellationToken ct = default)
    {
        var content = new StringContent(
            JsonSerializer.Serialize(new { channel = channelId }),
            Encoding.UTF8, "application/json");
        var resp = await _http.PostAsync($"{_baseUrl}/bridges/{bridgeId}/addChannel", content, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<string> OriginateToAppAsync(string endpoint, string app, CancellationToken ct = default)
    {
        var payload = new
        {
            endpoint,
            app,
            callerId = "Intercom <0000>",
            timeout = 30
        };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var resp = await _http.PostAsync($"{_baseUrl}/channels", content, ct);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("id").GetString()!;
    }
}
