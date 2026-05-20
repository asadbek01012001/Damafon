using System.Collections.Concurrent;
using Damafon.API.Models;

namespace Damafon.API.Services;

public interface ICallSessionService
{
    void AddSession(CallSession session);
    CallSession? GetSession(string channelId);
    CallSession? FindByWebphoneChannelId(string webphoneChannelId);
    void RemoveSession(string channelId);
    IEnumerable<CallSession> GetActiveSessions();
}

public class CallSessionService : ICallSessionService
{
    private readonly ConcurrentDictionary<string, CallSession> _sessions = new();

    public void AddSession(CallSession session) =>
        _sessions[session.ChannelId] = session;

    public CallSession? GetSession(string channelId) =>
        _sessions.GetValueOrDefault(channelId);

    public CallSession? FindByWebphoneChannelId(string webphoneChannelId) =>
        _sessions.Values.FirstOrDefault(s => s.WebphoneChannelId == webphoneChannelId);

    public void RemoveSession(string channelId) =>
        _sessions.TryRemove(channelId, out _);

    public IEnumerable<CallSession> GetActiveSessions() =>
        _sessions.Values.Where(s => s.Status != CallStatus.Ended);
}
