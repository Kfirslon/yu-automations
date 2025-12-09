/**
 * YU Event Alerts - Standalone Node.js Script
 * Fetches YU events from iCal feed, checks for new events, and sends email notifications
 * Run: node yu-event-alerts.js
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
const ICAL_URL = 'https://yeshiva.campusgroups.com/ical/yeshiva/ical_yeshiva.ics';
const CACHE_FILE = path.join(__dirname, 'events-cache.json');
const EMAIL_TO = 'kfirslon@gmail.com';

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD
    }
});

// Parse iCal date
function parseICalDate(str) {
    if (!str) return null;
    try {
        const y = str.substring(0, 4);
        const m = str.substring(4, 6);
        const d = str.substring(6, 8);
        const h = str.substring(9, 11) || '00';
        const min = str.substring(11, 13) || '00';
        return new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min)));
    } catch (e) {
        return null;
    }
}

// Fetch and parse iCal feed
async function fetchEvents() {
    console.log('Fetching iCal feed...');
    const response = await fetch(ICAL_URL);
    const icalText = await response.text();

    const fixedText = icalText.replace(/\\n/g, '\n');
    const events = [];
    const eventBlocks = fixedText.split('BEGIN:VEVENT');

    console.log(`Found ${eventBlocks.length - 1} events in feed`);

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i < eventBlocks.length; i++) {
        const block = eventBlocks[i];

        try {
            const uid = (block.match(/UID:([^\r\n]+)/) || [])[1];
            const summary = (block.match(/SUMMARY[^:]*:([^\r\n]+)/) || [])[1];
            const dtStart = (block.match(/DTSTART[^:]*:([^\r\n]+)/) || [])[1];
            const location = (block.match(/LOCATION:([^\r\n]+)/) || [])[1];
            const url = (block.match(/URL:([^\r\n]+)/) || [])[1];

            if (!uid || !summary) continue;

            const start = parseICalDate(dtStart);

            // Skip past events (before today)
            if (start && start < today) {
                continue;
            }

            events.push({
                id: uid.trim(),
                title: (summary || 'Untitled Event')
                    .replace(/ENCODING=QUOT[^:]*:/g, '')
                    .replace(/\\,/g, ',')
                    .replace(/\\n/g, ' ')
                    .replace(/\\;/g, ';')
                    .replace(/\\/g, '')
                    .trim(),
                date: start ? start.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'America/New_York'
                }) : 'TBD',
                time: start ? start.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/New_York'
                }) : 'TBD',
                location: location ? location.replace(/\\,/g, ',').replace(/\\/g, '').trim() : 'TBD',
                url: url ? url.trim() : 'https://yeshiva.campusgroups.com/events',
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error('Parse error:', e);
        }
    }

    console.log(`Successfully parsed ${events.length} current/future events`);
    return events;
}

// Load cache
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('No cache found, starting fresh');
    }
    return { seenIds: [] };
}

// Save cache
function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Send email notification
async function sendEmail(event) {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎓 New YU Event!</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px;">
        <div style="background: white; padding: 25px; border-radius: 8px;">
          <h2 style="color: #333; margin-top: 0;">${event.title}</h2>
          
          <div style="margin: 20px 0; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3;">
            <p style="margin: 8px 0;"><strong>📅 Date:</strong> ${event.date}</p>
            <p style="margin: 8px 0;"><strong>🕐 Time:</strong> ${event.time}</p>
            <p style="margin: 8px 0;"><strong>📍 Location:</strong> ${event.location}</p>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${event.url}" style="background: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold;">🎟️ REGISTER NOW</a>
          </div>
          
          <p style="color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px; margin-top: 20px;">⚡ Automated notification</p>
        </div>
      </div>
    </div>
  `;

    await transporter.sendMail({
        from: env.GMAIL_USER,
        to: EMAIL_TO,
        subject: `🚨 NEW YU EVENT: ${event.title}`,
        html: html
    });

    console.log(`✅ Email sent for: ${event.title}`);
}

// Main function
async function main() {
    console.log('=== YU Event Alerts ===');
    console.log(`Running at: ${new Date().toLocaleString()}`);

    try {
        // Fetch current events
        const events = await fetchEvents();

        // Load cache
        const cache = loadCache();
        const seenIds = new Set(cache.seenIds);

        // Find new events
        const newEvents = events.filter(e => !seenIds.has(e.id));
        console.log(`Found ${newEvents.length} new events`);

        // Limit to 10 events per run to avoid rate limiting
        const eventsToNotify = newEvents.slice(0, 10);
        if (newEvents.length > 10) {
            console.log(`Only sending ${eventsToNotify.length} emails to avoid rate limits`);
        }

        // Send emails for new events (with delay to avoid rate limiting)
        for (const event of eventsToNotify) {
            await sendEmail(event);
            // Wait 2 seconds between emails to avoid Gmail rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Mark all new events as seen (even if we didn't email all)
        for (const event of newEvents) {
            seenIds.add(event.id);
        }

        // Update cache
        cache.seenIds = Array.from(seenIds);
        saveCache(cache);

        console.log('Done!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
