// hash.js
const bcrypt = require('bcrypt');
const password = "123"; // Replace with your desired plain text password
bcrypt.hash(password, 10)
  .then(hash => {
    console.log("Hashed Password:", hash);
  })
  .catch(err => console.error(err));
