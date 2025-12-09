/**
 * YU Gym Shifts - GitHub Actions Version
 * Uses environment variables for credentials
 */

import nodemailer from 'nodemailer';

// Configuration from environment
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const GYM_SHIFTS_SHEET_ID = process.env.GYM_SHIFTS_SHEET_ID || '11AudHMD7PdzuSxRe-lci32qeoWN5sr-VU8jpbxhVa5U';
const EMAIL_TO = 'kfirslon@gmail.com';

// Pay Period Configuration
const ANCHOR_DATE = new Date('2025-11-29T00:00:00');
const PERIOD_LENGTH_DAYS = 14;

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
    }
});

// Calculate pay period
function getPayPeriod(date) {
    const timeDiff = date.getTime() - ANCHOR_DATE.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const periodIndex = Math.floor(daysDiff / PERIOD_LENGTH_DAYS);

    const periodStart = new Date(ANCHOR_DATE);
    periodStart.setDate(ANCHOR_DATE.getDate() + (periodIndex * PERIOD_LENGTH_DAYS));

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + PERIOD_LENGTH_DAYS - 1);

    return { periodStart, periodEnd };
}

// Format date as MM/DD/YYYY
function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Parse CSV
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => {
            row[h] = values[i] || '';
        });
        return row;
    });
}

// Fetch shifts from Google Sheets
async function fetchShifts() {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GYM_SHIFTS_SHEET_ID}/export?format=csv`;

    console.log('Fetching shifts from Google Sheets...');

    const response = await fetch(csvUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
    }
    const csvContent = await response.text();
    return parseCSV(csvContent);
}

// Main function
async function main() {
    console.log('=== YU Gym Shifts (GitHub Actions) ===');
    console.log(`Running at: ${new Date().toLocaleString()}`);

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables');
        process.exit(1);
    }

    try {
        const now = new Date();
        const currentPeriod = getPayPeriod(now);
        const periodStartStr = formatDate(currentPeriod.periodStart);
        const periodEndStr = formatDate(currentPeriod.periodEnd);

        console.log(`Pay Period: ${periodStartStr} – ${periodEndStr}`);

        const rows = await fetchShifts();

        let totalHours = 0;
        const shiftLines = [];

        for (const row of rows) {
            if (!row.Date || row.Date === 'Date' || row.Date === 'MM/DD/YYYY') continue;

            const dateParts = row.Date.split('/');
            if (dateParts.length !== 3) continue;

            const rowDate = new Date(
                parseInt(dateParts[2]),
                parseInt(dateParts[0]) - 1,
                parseInt(dateParts[1])
            );

            if (rowDate >= currentPeriod.periodStart && rowDate <= currentPeriod.periodEnd) {
                const hours = parseFloat(row.Hours) || 0;
                totalHours += hours;

                const hourText = hours === 1 ? 'hour' : 'hours';
                shiftLines.push(`${row.Date} — ${hours} ${hourText} (${row['Start Time']} - ${row['End Time']})`);
            }
        }

        shiftLines.sort();

        console.log(`Found ${shiftLines.length} shifts, Total: ${totalHours} hours`);

        const shiftListText = shiftLines.length > 0
            ? shiftLines.join('\n')
            : 'No shifts recorded for this pay period';

        const emailBody = `Pay Period: ${periodStartStr} – ${periodEndStr}

${shiftListText}

Total Hours: ${totalHours.toFixed(1)}`;

        await transporter.sendMail({
            from: GMAIL_USER,
            to: EMAIL_TO,
            subject: 'YU Gym Shifts — Weekly Pay Period Summary',
            text: emailBody
        });

        console.log('✅ Email sent successfully!');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
