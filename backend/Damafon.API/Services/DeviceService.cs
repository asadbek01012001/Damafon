using System.Text.Json;
using Damafon.API.Models;

namespace Damafon.API.Services;

public interface IDeviceService
{
    IEnumerable<Device> GetAll();
    Device? GetById(string id);
    Device? FindBySipCallerId(string callerId);
    Device Add(Device device);
    Device? Update(string id, Device device);
    bool Delete(string id);
}

public class DeviceService : IDeviceService
{
    private readonly string _filePath;
    private readonly ILogger<DeviceService> _logger;
    private List<Device> _devices = new();
    private readonly object _lock = new();

    private static readonly JsonSerializerOptions _json = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public DeviceService(IConfiguration config, ILogger<DeviceService> logger)
    {
        _logger = logger;
        var dataDir = config["DataPath"] ?? "/data";
        Directory.CreateDirectory(dataDir);
        _filePath = Path.Combine(dataDir, "devices.json");
        Load();
    }

    private void Load()
    {
        if (!File.Exists(_filePath)) return;
        try
        {
            var json = File.ReadAllText(_filePath);
            _devices = JsonSerializer.Deserialize<List<Device>>(json, _json) ?? new();
            _logger.LogInformation("Loaded {Count} device(s) from {Path}", _devices.Count, _filePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load devices");
            _devices = new();
        }
    }

    private void Save()
    {
        File.WriteAllText(_filePath, JsonSerializer.Serialize(_devices, _json));
    }

    public IEnumerable<Device> GetAll()
    {
        lock (_lock) return _devices.ToList();
    }

    public Device? GetById(string id)
    {
        lock (_lock) return _devices.FirstOrDefault(d => d.Id == id);
    }

    public Device? FindBySipCallerId(string callerId)
    {
        lock (_lock) return _devices.FirstOrDefault(d =>
            d.Enabled && d.SipCallerId == callerId);
    }

    public Device Add(Device device)
    {
        device.Id = Guid.NewGuid().ToString("N")[..8];
        device.CreatedAt = DateTime.UtcNow;
        lock (_lock)
        {
            _devices.Add(device);
            Save();
        }
        _logger.LogInformation("Device added: {Name} ({Id})", device.Name, device.Id);
        return device;
    }

    public Device? Update(string id, Device updated)
    {
        lock (_lock)
        {
            var idx = _devices.FindIndex(d => d.Id == id);
            if (idx < 0) return null;
            updated.Id = id;
            updated.CreatedAt = _devices[idx].CreatedAt;
            _devices[idx] = updated;
            Save();
            return updated;
        }
    }

    public bool Delete(string id)
    {
        lock (_lock)
        {
            var removed = _devices.RemoveAll(d => d.Id == id) > 0;
            if (removed) Save();
            return removed;
        }
    }
}
