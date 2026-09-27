const axios = require('axios');

const sendEmail = async (options) => {
  // Use EmailJS REST API
  const data = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: options.templateId || process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: {
      to_email: options.to,
      to_name: options.name,
      user_password: options.password,
      otp: options.otp
    }
  };

  try {
    await axios.post('https://api.emailjs.com/api/v1.0/email/send', data);
  } catch (error) {
    console.error('EmailJS Error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = sendEmail;
