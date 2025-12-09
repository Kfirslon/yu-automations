/**
 * YU Gym Shifts - Weekly Pay Period Summary
 * Reads shifts from Google Sheets and sends weekly email summary
 * Run: node yu-gym-shifts.js
 * 
 * NOTE: This version uses a local CSV file. To use Google Sheets directly,
 * you'd need to set up Google Sheets API credentials.
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
        env[key.trim()] = valueParts.join('=').trim();
    }
});

// Configuration
const SHIFTS_FILE = path.join(__dirname, 'gym-shifts.csv');
const EMAIL_TO = 'kfirslon@gmail.com';

// Pay Period Configuration
const ANCHOR_DATE = new Date('2025-11-29T00:00:00');
const PERIOD_LENGTH_DAYS = 14;

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD
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

// Parse CSV file
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

// Fetch shifts from Google Sheets (public CSV export)
async function fetchShifts() {
    const sheetId = env.GYM_SHIFTS_SHEET_ID;
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    console.log('Fetching shifts from Google Sheets...');

    try {
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }
        const csvContent = await response.text();
        return parseCSV(csvContent);
    } catch (error) {
        console.error('Error fetching from Google Sheets:', error.message);
        console.log('Make sure the sheet is shared as "Anyone with the link can view"');

        // Fallback to local file
        if (fs.existsSync(SHIFTS_FILE)) {
            console.log('Using local CSV file instead...');
            const content = fs.readFileSync(SHIFTS_FILE, 'utf8');
            return parseCSV(content);
        }

        return [];
    }
}

// Main function
async function main() {
    console.log('=== YU Gym Shifts - Weekly Summary ===');
    console.log(`Running at: ${new Date().toLocaleString()}`);

    try {
        // Get current pay period
        const now = new Date();
        const currentPeriod = getPayPeriod(now);
        const periodStartStr = formatDate(currentPeriod.periodStart);
        const periodEndStr = formatDate(currentPeriod.periodEnd);

        console.log(`Pay Period: ${periodStartStr} – ${periodEndStr}`);

        // Fetch shifts
        const rows = await fetchShifts();

        let totalHours = 0;
        const shiftLines = [];
        const seenShifts = new Set(); // Track duplicates

        // Process each row
        for (const row of rows) {
            if (!row.Date || row.Date === 'Date' || row.Date === 'MM/DD/YYYY') continue;

            const dateParts = row.Date.split('/');
            if (dateParts.length !== 3) continue;

            // Create unique key for this shift (date + start + end time)
            const shiftKey = `${row.Date}|${row['Start Time']}|${row['End Time']}`;

            // Skip if we've already seen this shift
            if (seenShifts.has(shiftKey)) {
                console.log(`Skipping duplicate: ${row.Date} ${row['Start Time']}-${row['End Time']}`);
                continue;
            }
            seenShifts.add(shiftKey);

            const rowDate = new Date(
                parseInt(dateParts[2]),
                parseInt(dateParts[0]) - 1,
                parseInt(dateParts[1])
            );

            // Check if in current pay period
            if (rowDate >= currentPeriod.periodStart && rowDate <= currentPeriod.periodEnd) {
                const hours = parseFloat(row.Hours) || 0;
                totalHours += hours;

                const hourText = hours === 1 ? 'hour' : 'hours';
                shiftLines.push(`${row.Date} — ${hours} ${hourText} (${row['Start Time']} - ${row['End Time']})`);
            }
        }

        // Sort shifts by date
        shiftLines.sort();

        console.log(`Found ${shiftLines.length} unique shifts, Total: ${totalHours} hours`);

        // Build email body
        const shiftListText = shiftLines.length > 0
            ? shiftLines.join('\n')
            : 'No shifts recorded for this pay period';

        const emailBody = `Pay Period: ${periodStartStr} – ${periodEndStr}

${shiftListText}

Total Hours: ${totalHours.toFixed(1)}`;

        // Send email
        await transporter.sendMail({
            from: env.GMAIL_USER,
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
