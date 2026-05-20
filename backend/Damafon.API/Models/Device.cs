namespace Damafon.API.Models;

public enum DeviceBrand { Dahua, Hikvision }

public class Device
{
    public DeviceBrand Brand { get; set; } = DeviceBrand.Dahua;
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public bool SipEnabled { get; set; } = true;

    // Dahua qurilma SIP Caller ID (Dahua admin → Local Number)
    public string SipCallerId { get; set; } = "";

    // RTSP video stream
    public string RtspHost { get; set; } = "";
    public int RtspPort { get; set; } = 554;
    public string RtspUsername { get; set; } = "admin";
    public string RtspPassword { get; set; } = "";
    public int RtspChannel { get; set; } = 1;

    // HTTP eshik boshqaruvi
    public string HttpHost { get; set; } = "";
    public int HttpPort { get; set; } = 80;
    public string HttpUsername { get; set; } = "admin";
    public string HttpPassword { get; set; } = "";
    public int HttpChannel { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
