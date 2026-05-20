namespace Damafon.API.Services;

public class Go2rtcSyncService : IHostedService
{
    private readonly IDeviceService _devices;
    private readonly IGo2rtcService _go2rtc;
    private readonly ILogger<Go2rtcSyncService> _logger;

    public Go2rtcSyncService(IDeviceService devices, IGo2rtcService go2rtc, ILogger<Go2rtcSyncService> logger)
    {
        _devices = devices;
        _go2rtc = go2rtc;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        // Wait briefly for go2rtc to be ready
        await Task.Delay(TimeSpan.FromSeconds(2), ct);

        var enabled = _devices.GetAll().Where(d => d.Enabled).ToList();
        _logger.LogInformation("Registering {Count} device stream(s) with go2rtc...", enabled.Count);

        foreach (var device in enabled)
        {
            await _go2rtc.AddStreamAsync(device, ct);
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
