const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS // App Password for Gmail
        }
    });
};

// Send invitation email
const sendInvitationEmail = async (toEmail, toName, tempPassword, activationToken, invitedBy) => {
    const transporter = createTransporter();

    const activationLink = `${process.env.APP_URL || 'http://localhost:5173'}/activate?token=${activationToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"CASH App" <noreply@cash.com>',
        to: toEmail,
        subject: 'Convite para CASH - Sistema de Gestão Financeira',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #00425F 0%, #2F6C81 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 30px; background: #DAB177; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                    .info-box { background: white; padding: 15px; border-left: 4px solid #00425F; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Bem-vindo ao CASH!</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${toName}</strong>,</p>
                        
                        <p>Você foi convidado por <strong>${invitedBy}</strong> para fazer parte do sistema CASH - Sistema de Gestão Financeira.</p>
                        
                        <div class="info-box">
                            <p><strong>📧 Seu e-mail:</strong> ${toEmail}</p>
                            <p><strong>🔑 Senha temporária:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
                        </div>
                        
                        <p><strong>⚠️ Importante:</strong> Por segurança, você precisará criar uma nova senha no primeiro acesso.</p>
                        
                        <p style="text-align: center;">
                            <a href="${activationLink}" class="button">Ativar Minha Conta</a>
                        </p>
                        
                        <p style="font-size: 12px; color: #666;">
                            Ou copie e cole este link no seu navegador:<br>
                            <a href="${activationLink}">${activationLink}</a>
                        </p>
                        
                        <p style="margin-top: 30px; font-size: 14px; color: #666;">
                            Este link é válido por 48 horas.
                        </p>
                    </div>
                    <div class="footer">
                        <p>CASH - Sistema de Gestão Financeira</p>
                        <p>Este é um e-mail automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send invitation email: ' + error.message);
    }
};

// Send password reset email
const sendPasswordResetEmail = async (toEmail, toName, resetToken) => {
    const transporter = createTransporter();

    const resetLink = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"CASH App" <noreply@cash.com>',
        to: toEmail,
        subject: 'Redefinição de Senha - CASH',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #00425F 0%, #2F6C81 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 30px; background: #DAB177; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Redefinição de Senha</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${toName}</strong>,</p>
                        
                        <p>Recebemos uma solicitação para redefinir sua senha no CASH.</p>
                        
                        <p style="text-align: center;">
                            <a href="${resetLink}" class="button">Redefinir Senha</a>
                        </p>
                        
                        <p style="font-size: 12px; color: #666;">
                            Ou copie e cole este link no seu navegador:<br>
                            <a href="${resetLink}">${resetLink}</a>
                        </p>
                        
                        <p style="margin-top: 30px; font-size: 14px; color: #666;">
                            Este link é válido por 1 hora.<br>
                            Se você não solicitou esta redefinição, ignore este e-mail.
                        </p>
                    </div>
                    <div class="footer">
                        <p>CASH - Sistema de Gestão Financeira</p>
                        <p>Este é um e-mail automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Failed to send password reset email: ' + error.message);
    }
};

module.exports = {
    sendInvitationEmail,
    sendPasswordResetEmail
};
