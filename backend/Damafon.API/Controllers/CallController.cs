using Damafon.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace Damafon.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CallController : ControllerBase
{
    private readonly ICallSessionService _sessions;
    private readonly IAriRestClient _ari;

    public CallController(ICallSessionService sessions, IAriRestClient ari)
    {
        _sessions = sessions;
        _ari = ari;
    }

    [HttpGet("active")]
    public IActionResult GetActiveCalls() =>
        Ok(_sessions.GetActiveSessions());

    [HttpDelete("{channelId}")]
    public async Task<IActionResult> Hangup(string channelId, CancellationToken ct)
    {
        await _ari.HangupChannelAsync(channelId, "normal", ct);
        _sessions.RemoveSession(channelId);
        return NoContent();
    }
}
