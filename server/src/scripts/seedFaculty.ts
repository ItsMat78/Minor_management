import mongoose from 'mongoose';
import User, { UserRole } from '../models/User';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedFaculty = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/minor-project-portal');
        console.log('Connected to MongoDB');

        // Read the faculty list file
        const facultyListPath = path.join(__dirname, '../../../faculty_list.txt');
        const fileContent = fs.readFileSync(facultyListPath, 'utf-8');
        const lines = fileContent.split('\n');

        const facultyToAdd = [];
        const seenEmails = new Set();
        const seenNames = new Set();

        let currentFaculty: any = null;

        for (const line of lines) {
            const rawLine = line.trim();
            if (!rawLine) continue;

            // Check for Research:
            // "Research :Bio-metrics, ..."
            // Regex: ^Research\s*[:]\s*(.*)
            const researchMatch = rawLine.match(/^Research\s*[:]\s*(.*)/i);

            if (researchMatch && currentFaculty) {
                const expertiseStr = researchMatch[1].trim();
                // Split by comma or semicolon, remove "Read More"
                // Also handle "and" sometimes? Just splitting by comma is safer for now.
                const expertise = expertiseStr.split(/[;,]/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.toLowerCase().includes('read more') && s !== '.');

                currentFaculty.expertise = expertise;
                continue;
            }

            // Check for Name line
            // Looking for "Name (Designation)" pattern
            // Regex to capture name before the first opening parenthesis and content inside
            const nameMatch = rawLine.match(/^(?:HYPERLINK\s+".*?")?\s*([^(]+?)\s*\((.*?)\)/);

            if (nameMatch) {
                let fullName = nameMatch[1].trim();
                let parenContent = nameMatch[2].trim();

                // Junk removal logic
                if (fullName.startsWith('HYPERLINK')) {
                    const m = fullName.match(/HYPERLINK\s+".*?"(.*?)$/);
                    if (m) fullName = m[1].trim();
                }

                // More robust junk filtration
                const invalidPrefixes = [
                    'Qualification', 'Department', 'Email', 'Contact', 'Research', 'Read More', 'Designation',
                    'Sitemap', 'Terms', 'Privacy', 'FAQs', 'RTI', 'Helpline', 'Page last updated',
                    'OLA', 'Telephone', 'General Information', 'Route', 'Useful Services', 'Convocation',
                    'Admissions', 'HR', 'Placement', 'Ph.D.', 'M.Tech.', 'B.Tech'
                ];
                if (invalidPrefixes.some(p => fullName.startsWith(p)) || fullName.includes('http') || fullName.length < 3) {
                    continue;
                }

                // If valid name found, save previous faculty
                if (currentFaculty) {
                    facultyToAdd.push(currentFaculty);
                    currentFaculty = null;
                }

                if (seenNames.has(fullName)) continue;
                seenNames.add(fullName);

                // parse email
                const nameParts = fullName.split(' ');
                let firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, '');

                if (firstName === 'dr' && nameParts.length > 1) {
                    firstName = nameParts[1].toLowerCase().replace(/[^a-z]/g, '');
                }

                if (!firstName) continue;

                let email = `${firstName}@iiitnr.edu.in`;
                if (seenEmails.has(email)) {
                    // Try to resolve collision with last name or middle name
                    // e.g. "Amit Kumar Agrawal" vs "Amit ..."
                    // If simple first name fails, try initials + last name logic?
                    // Or first name + last name part.
                    // Let's iterate parts to find unique email
                    let foundUnique = false;
                    for (let i = 1; i < nameParts.length; i++) {
                        const nextPart = nameParts[i].toLowerCase().replace(/[^a-z]/g, '');
                        const tryEmail = `${firstName}.${nextPart}@iiitnr.edu.in`;
                        if (!seenEmails.has(tryEmail)) {
                            email = tryEmail;
                            foundUnique = true;
                            break;
                        }
                    }
                    if (!foundUnique) {
                        // Fallback: append number?
                        let counter = 1;
                        while (seenEmails.has(email)) {
                            email = `${firstName}${counter}@iiitnr.edu.in`;
                            counter++;
                        }
                    }
                }
                seenEmails.add(email);

                // Department
                let department = 'DS';
                const content = parenContent.toUpperCase();
                if (content.includes('ECE')) department = 'ECE';
                else if (content.includes('CSE')) department = 'CSE';
                else if (content.includes('DSAI')) department = 'DSAI';
                else if (content.includes('SHM') || content.includes('MATH') || content.includes('ENGLISH') || content.includes('PHYSICS')) department = 'SHM';
                else if (content.includes('MANAGEMENT')) department = 'Management';

                currentFaculty = {
                    name: fullName,
                    email: email,
                    password: await bcrypt.hash('123456', 10),
                    role: UserRole.FACULTY,
                    department: department,
                    expertise: [],
                    isVerified: true
                };
            }
        }
        // Push last one
        if (currentFaculty) facultyToAdd.push(currentFaculty);

        console.log(`Found ${facultyToAdd.length} faculty members.`);

        // Delete existing faculty
        console.log('Clearing existing faculty...');
        await User.deleteMany({ role: UserRole.FACULTY });

        // Insert new faculty
        if (facultyToAdd.length > 0) {
            await User.insertMany(facultyToAdd);
            console.log('Faculty seeded successfully.');
        } else {
            console.log('No faculty found to seed.');
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('Error seeding faculty:', error);
        process.exit(1);
    }
};

seedFaculty();
