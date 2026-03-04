import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: 'GomiCale Contact <contact@gomicale.jp>',
      to: ['gomicalecontact@gmail.com'], // あなたの受信箱に届くように設定
      replyTo: email,
      subject: `[GomiCale] お問い合わせ: ${name}様より`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
    })

    if (error) {
      console.error('Error sending contact email:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Unexpected error in contact API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
