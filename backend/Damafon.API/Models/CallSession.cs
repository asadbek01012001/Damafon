namespace Damafon.API.Models;

public enum CallStatus { Ringing, Answered, Ended, Rejected }

public class CallSession
{
    public string ChannelId { get; set; } = string.Empty;
    public string CallerId { get; set; } = string.Empty;
    public string? DeviceId { get; set; }
    public string? DeviceName { get; set; }
    public CallStatus Status { get; set; } = CallStatus.Ringing;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AnsweredAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? BridgeId { get; set; }
    public string? WebphoneChannelId { get; set; }
    public bool SipEnabled { get; set; } = true;
}

public record IncomingCallDto(
    string ChannelId,
    string CallerId,
    string? DeviceId,
    string? DeviceName,
    DateTime Timestamp,
    bool SipEnabled);

public record CallEndedDto(string ChannelId, string Reason);
public record CallAnsweredDto(string ChannelId, DateTime AnsweredAt);
