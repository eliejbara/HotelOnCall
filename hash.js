const bcrypt = require('bcrypt');

async function hashPassword() {
    const password = "cleaner";  // The plain text password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed Password:", hashedPassword);
}

hashPassword();
