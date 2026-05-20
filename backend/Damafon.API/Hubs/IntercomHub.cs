using Damafon.API.Models;
using Damafon.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace Damafon.API.Hubs;

public class IntercomHub : Hub
{
    private readonly ICallSessionService _sessions;
    private readonly IAriRestClient _ari;
    private readonly ILogger<IntercomHub> _logger;

    public IntercomHub(ICallSessionService sessions, IAriRestClient ari, ILogger<IntercomHub> logger)
    {
        _sessions = sessions;
        _ari = ari;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);

        // Send active sessions so client can show any missed incoming call
        var active = _sessions.GetActiveSessions().ToList();
        if (active.Count > 0)
            await Clients.Caller.SendAsync("ActiveSessions", active);

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task AnswerCall(string channelId)
    {
        var session = _sessions.GetSession(channelId);
        if (session == null)
        {
            await Clients.Caller.SendAsync("Error", "Session not found");
            return;
        }

        // SIP bo'lmagan qurilmalar (Hikvision Access Control va h.k.)
        // Audio WebRTC backchannel orqali go2rtc dan keladi — Asterisk bridging shart emas
        if (!session.SipEnabled)
        {
            session.Status = CallStatus.Answered;
            session.AnsweredAt = DateTime.UtcNow;
            try { await _ari.AnswerChannelAsync(channelId); } catch { }
            await Clients.Caller.SendAsync("CallAnswered",
                new CallAnsweredDto(channelId, session.AnsweredAt.Value));
            return;
        }

        try
        {
            await _ari.AnswerChannelAsync(channelId);

            var bridgeId = await _ari.CreateBridgeAsync();
            session.BridgeId = bridgeId;

            await _ari.AddChannelToBridgeAsync(bridgeId, channelId);

            // Webphone ga Stasis app orqali chaqiruv — kanal qabul qilinganda
            // AriService.OnStasisStartAsync uni bridge ga qo'shadi (event-driven)
            var webphoneChannelId = await _ari.OriginateToAppAsync("PJSIP/webphone", "intercom");
            session.WebphoneChannelId = webphoneChannelId;

            _logger.LogInformation("Call {ChannelId} answered, waiting for webphone {WpCh} on bridge {BridgeId}",
                channelId, webphoneChannelId, bridgeId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to answer call {ChannelId}", channelId);
            await Clients.Caller.SendAsync("Error", "Failed to answer call");
        }
    }

    public async Task RejectCall(string channelId)
    {
        try
        {
            await _ari.HangupChannelAsync(channelId, "busy");
            _sessions.RemoveSession(channelId);
            _logger.LogInformation("Call {ChannelId} rejected", channelId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reject call {ChannelId}", channelId);
        }
    }

    public async Task HangupCall(string channelId)
    {
        var session = _sessions.GetSession(channelId);
        if (session == null) return;

        try
        {
            await _ari.HangupChannelAsync(channelId);
            if (session.WebphoneChannelId != null)
                await _ari.HangupChannelAsync(session.WebphoneChannelId);

            _sessions.RemoveSession(channelId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to hangup call {ChannelId}", channelId);
        }
    }
}
