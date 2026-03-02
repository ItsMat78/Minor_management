const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'e:/Projects/Minor_management/server/.env' });
console.log(jwt.sign({ id: 'someId' }, process.env.JWT_SECRET || 'secret'));
