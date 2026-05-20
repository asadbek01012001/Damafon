using Damafon.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace Damafon.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DoorController : ControllerBase
{
    private readonly IDoorService _door;
    private readonly ILogger<DoorController> _logger;

    public DoorController(IDoorService door, ILogger<DoorController> logger)
    {
        _door = door;
        _logger = logger;
    }

    /// <summary>Remotely open the intercom door.</summary>
    [HttpPost("open")]
    public async Task<IActionResult> Open(CancellationToken ct)
    {
        _logger.LogInformation("Door open requested from {Ip}", HttpContext.Connection.RemoteIpAddress);

        var success = await _door.OpenDoorAsync(ct);
        if (success)
            return Ok(new { success = true, message = "Door opened" });

        return StatusCode(502, new { success = false, message = "Door device did not respond" });
    }
}
