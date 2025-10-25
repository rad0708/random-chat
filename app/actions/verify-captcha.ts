"use server"

export async function verifyCaptcha(token: string): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.HCAPTCHA_SECRET_KEY

  if (!secretKey) {
    // Development mode: allow without verification
    if (process.env.NODE_ENV === "development") {
      return { success: true }
    }
    return { success: false, error: "서버 설정 오류" }
  }

  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `response=${token}&secret=${secretKey}`,
    })

    const data = await response.json()

    if (data.success) {
      return { success: true }
    } else {
      return { success: false, error: "인증 실패" }
    }
  } catch (error) {
    return { success: false, error: "인증 서버 오류" }
  }
}
