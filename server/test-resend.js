// Test script to verify Resend API connection
const { Resend } = require('resend');

const RESEND_API_KEY = 're_N95sU63m_Etv1pSD9Vmb5ecsMkQJi6N1Z';
const resend = new Resend(RESEND_API_KEY);

async function testResend() {
  console.log('Testing Resend API connection...');
  console.log('API Key:', RESEND_API_KEY.substring(0, 10) + '...');
  
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'mdkaif196905@gmail.com',
      subject: 'Test Email from SeniorPill',
      html: '<p>This is a test email to verify Resend API is working.</p>',
    });
    
    console.log('\n✅ Resend API Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('\n❌ Error:', result.error);
    } else if (result.data && result.data.id) {
      console.log('\n✅ Email sent successfully!');
      console.log('Email ID:', result.data.id);
    } else {
      console.log('\n⚠️ Unexpected response:', result);
    }
  } catch (error) {
    console.error('\n❌ Exception caught:');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

testResend();
