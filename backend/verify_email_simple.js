const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Manual .env parser
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...parts] = trimmed.split('=');
            if (key && parts.length > 0) {
                process.env[key.trim()] = parts.join('=').trim();
            }
        }
    });
}

async function verifyEmail() {
    console.log('Testing Email Configuration...');
    console.log(`Host: ${process.env.EMAIL_HOST}`);
    console.log(`User: ${process.env.EMAIL_USER}`);

    const transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        console.log('Verifying setup...');
        await transporter.verify();
        console.log('SMTP Connection Success!');

        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Teste de Configuração CASH',
            text: 'Se você recebeu este e-mail, a configuração do sistema CASH está funcionando corretamente!',
            html: '<b>Se você recebeu este e-mail, a configuração do sistema CASH está funcionando corretamente!</b>'
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Error:', error);
    }
}

verifyEmail();
