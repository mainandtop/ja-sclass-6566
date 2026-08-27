/* =======================================================================
   Vercel Serverless Function — 관심고객등록 메일 발송 (Gmail / nodemailer)
   -----------------------------------------------------------------------
   필요한 환경변수 (Vercel > Settings > Environment Variables):
     EMAIL_USER       : 발송용 Gmail 주소 (예: yourid@gmail.com)
     EMAIL_PASS       : Gmail "앱 비밀번호" 16자리 (일반 비밀번호 아님)
                        → Google 계정 > 보안 > 2단계 인증 > 앱 비밀번호에서 발급
     RECEIVER_EMAILS  : 수신 이메일(콤마로 여러 개 지정 가능 → 여기만 늘리면 됨)
                        예) "momoseya55@gmail.com, sales@example.com"
     SITE_NAME        : 사이트명 (메일 제목/본문 표기용)
   ======================================================================= */

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { from_name, phone, unit_type } = body || {};

  if (!from_name || !phone) {
    return res.status(400).json({ success: false, error: '성함과 연락처는 필수입니다.' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ success: false, error: '메일 발송 설정 오류 (EMAIL_USER/EMAIL_PASS 없음)' });
  }

  // 수신자: 콤마로 구분된 여러 주소 지원
  const receivers = (process.env.RECEIVER_EMAILS || process.env.RECEIVER_EMAIL || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (receivers.length === 0) {
    return res.status(500).json({ success: false, error: '수신 이메일이 설정되지 않았습니다.' });
  }

  const siteName = process.env.SITE_NAME || '부산 장안지구 중흥S-클래스';
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
      <div style="background:#17301F;padding:24px 28px;color:#fff">
        <h2 style="margin:0;font-size:18px;letter-spacing:1px">${esc(siteName)} 관심고객등록</h2>
        <p style="margin:6px 0 0;font-size:12px;color:#C2A25E">${now}</p>
      </div>
      <div style="padding:26px 28px;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:12px 0;width:96px;color:#17301F;font-weight:700">성함</td>
            <td style="padding:12px 0">${esc(from_name)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:12px 0;color:#17301F;font-weight:700">연락처</td>
            <td style="padding:12px 0"><strong>${esc(phone)}</strong></td>
          </tr>
          <tr>
            <td style="padding:12px 0;color:#17301F;font-weight:700">관심 타입</td>
            <td style="padding:12px 0">${esc(unit_type || '미선택')}</td>
          </tr>
        </table>
      </div>
      <div style="padding:14px 28px;background:#F4F2EA;font-size:11px;color:#999">
        본 메일은 ${esc(siteName)} 관심고객등록 폼을 통해 자동 발송되었습니다.
      </div>
    </div>`;

  try {
    // 수신자별 개별 발송 — to에 배열 전달 시 Gmail SMTP가 타 도메인 주소를 누락하는 문제 방지
    for (const recipient of receivers) {
      await transporter.sendMail({
        from: `"${siteName} 관심등록" <${process.env.EMAIL_USER}>`,
        to: recipient,
        subject: `[관심등록] ${from_name} / ${phone} — ${siteName}`,
        html,
      });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Mail error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
