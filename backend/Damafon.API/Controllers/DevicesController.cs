using Damafon.API.Models;
using Damafon.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace Damafon.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevicesController : ControllerBase
{
    private readonly IDeviceService _devices;
    private readonly IGo2rtcService _go2rtc;

    public DevicesController(IDeviceService devices, IGo2rtcService go2rtc)
    {
        _devices = devices;
        _go2rtc = go2rtc;
    }

    [HttpGet]
    public IActionResult GetAll() => Ok(_devices.GetAll());

    [HttpGet("{id}")]
    public IActionResult GetById(string id)
    {
        var device = _devices.GetById(id);
        return device is null ? NotFound() : Ok(device);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Device device, CancellationToken ct)
    {
        var created = _devices.Add(device);
        if (created.Enabled)
            await _go2rtc.AddStreamAsync(created, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] Device device, CancellationToken ct)
    {
        var updated = _devices.Update(id, device);
        if (updated is null) return NotFound();

        await _go2rtc.RemoveStreamAsync(id, ct);
        if (updated.Enabled)
            await _go2rtc.AddStreamAsync(updated, ct);

        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var removed = _devices.Delete(id);
        if (!removed) return NotFound();
        await _go2rtc.RemoveStreamAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id}/open-door")]
    public async Task<IActionResult> OpenDoor(string id, [FromServices] IDoorService door, CancellationToken ct)
    {
        var device = _devices.GetById(id);
        if (device is null) return NotFound();
        var ok = await door.OpenDoorAsync(device, ct);
        return ok ? Ok(new { success = true }) : StatusCode(502, new { success = false });
    }
}
