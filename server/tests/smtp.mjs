/* A tiny SMTP server for tests: it records every email it is given (no TLS, no real delivery). */
import net from "node:net";

const decodeWord = (s) => s.replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, "base64").toString("utf8"));

export async function startSmtp(port) {
  const mails = [];
  const server = net.createServer((sock) => {
    let mode = "cmd";
    let buf = "";
    let cur = { rcpt: [], from: "", data: "" };
    let auth = 0;
    sock.write("220 test\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        if (mode === "data") {
          const end = buf.indexOf("\r\n.\r\n");
          if (end === -1) return;
          cur.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          mails.push(cur);
          cur = { rcpt: [], from: "", data: "" };
          mode = "cmd";
          sock.write("250 queued\r\n");
          continue;
        }
        const i = buf.indexOf("\r\n");
        if (i === -1) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (auth > 0) {
          auth--;
          sock.write(auth ? "334 UGFzc3dvcmQ6\r\n" : "235 ok\r\n");
          continue;
        }
        if (/^EHLO/i.test(line)) sock.write("250-test\r\n250 AUTH LOGIN\r\n");
        else if (/^AUTH LOGIN/i.test(line)) { auth = 2; sock.write("334 VXNlcm5hbWU6\r\n"); }
        else if (/^MAIL FROM:/i.test(line)) { cur.from = line.slice(10).replace(/[<>]/g, ""); sock.write("250 ok\r\n"); }
        else if (/^RCPT TO:/i.test(line)) { cur.rcpt.push(line.slice(8).replace(/[<>]/g, "")); sock.write("250 ok\r\n"); }
        else if (/^DATA/i.test(line)) { mode = "data"; sock.write("354 go\r\n"); }
        else if (/^QUIT/i.test(line)) { sock.end("221 bye\r\n"); return; }
        else sock.write("250 ok\r\n");
      }
    });
    sock.on("error", () => {});
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const decode = (m) => {
    const [head, ...rest] = m.data.split("\r\n\r\n");
    return {
      rcpt: m.rcpt,
      from: m.from,
      head,
      subject: decodeWord((/^Subject: (.*)$/m.exec(head) || [])[1] || ""),
      body: Buffer.from(rest.join("").replace(/\r\n/g, ""), "base64").toString("utf8"),
    };
  };
  return { mails: () => mails.map(decode), stop: () => server.close() };
}
