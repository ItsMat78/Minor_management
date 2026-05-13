// Credentials for test users seeded by global-setup.ts.
// All users live in the `minor_management_e2e` database — never the dev DB.

export const ADMIN = {
    name: 'E2E Admin',
    email: 'admin_e2e@iiitnr.ac.in',
    password: 'AdminE2E!123',
};

export const FACULTY = {
    name: 'E2E Faculty',
    email: 'faculty_e2e@iiitnr.ac.in',
    password: 'FacultyE2E!123',
    department: 'CSE',
};

export const STUDENT = {
    name: 'E2E Student',
    email: 'student_e2e@iiitnr.ac.in',
    password: 'StudentE2E!123',
    rollNumber: '23IT901',
};

// isVerified: false — triggers OTP screen on login
export const UNVERIFIED = {
    name: 'E2E Unverified',
    email: 'unverified_e2e@iiitnr.ac.in',
    password: 'StudentE2E!123',
    rollNumber: '23IT902',
};

// mustChangePassword: true — triggers forced redirect to /change-password
export const FIRST_LOGIN = {
    name: 'E2E First Login',
    email: 'firstlogin_e2e@iiitnr.ac.in',
    password: 'StudentE2E!123',
    rollNumber: '23IT903',
};
