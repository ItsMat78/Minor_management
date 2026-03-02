const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'e:/Projects/Minor_management/server/.env' });
const token = jwt.sign({ id: 'someId' }, process.env.JWT_SECRET || 'secret');
const http = require('http');

http.get('http://localhost:5000/api/groups', { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        try {
            const g = JSON.parse(d);
            if (Array.isArray(g)) {
                const withTarget = g.filter(x => x.targetBatch);
                console.log("Groups with targetBatch from API:", withTarget.length);
                console.log(withTarget.map(x => ({ id: x._id, name: x.name, targetBatch: x.targetBatch })));
            } else {
                console.log("Not array:", d);
            }
        } catch (e) {
            console.log("Error parsing:", d);
        }
    });
});
