// server.js - AI-Powered Influencer CRM & Campaign Automation for boAt
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { db, initSchema, seedData } = require('./db');
const { evaluateInfluencer, auditScript, generateCampaignInsights } = require('./ai-engine');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize database schema
initSchema();

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) { // 2MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// JSON Response helper
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Error response helper
function sendError(res, message, statusCode = 400) {
  sendJSON(res, { error: message, success: false }, statusCode);
}

// Serve static files
function serveStatic(req, res, filePath) {
  let normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()) {
    normalizedPath = path.join(normalizedPath, 'index.html');
  }

  if (!fs.existsSync(normalizedPath)) {
    // Fallback to index.html for SPA
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(content);
    }
    res.writeHead(404);
    return res.end('Not Found');
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(normalizedPath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

// Main HTTP request handler
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ==========================================
    // API: Executive Dashboard Stats
    // ==========================================
    if (pathname === '/api/stats' && method === 'GET') {
      const totalInfluencers = db.prepare('SELECT COUNT(*) as count FROM influencers').get().count;
      const activeCampaigns = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'Active'").get().count;
      const scriptsInReview = db.prepare("SELECT COUNT(*) as count FROM scripts WHERE status IN ('Submitted', 'Changes Requested')").get().count;
      const publishedPosts = db.prepare('SELECT COUNT(*) as count, SUM(reach) as total_reach, SUM(views) as total_views, AVG(cpe) as avg_cpe FROM content_posts').get();
      const avgScore = db.prepare('SELECT AVG(suitability_score) as avg_score FROM influencers WHERE suitability_score > 0').get().avg_score || 85;

      const pipelineCounts = db.prepare(`
        SELECT status, COUNT(*) as count FROM influencers GROUP BY status
      `).all();

      const recentActivities = db.prepare(`
        SELECT l.*, i.name as influencer_name, c.title as campaign_title 
        FROM activity_logs l
        LEFT JOIN influencers i ON l.influencer_id = i.id
        LEFT JOIN campaigns c ON l.campaign_id = c.id
        ORDER BY l.created_at DESC LIMIT 6
      `).all();

      return sendJSON(res, {
        success: true,
        stats: {
          totalInfluencers,
          activeCampaigns,
          scriptsInReview,
          totalReach: publishedPosts.total_reach || 505000,
          totalViews: publishedPosts.total_views || 596000,
          avgCpe: Number((publishedPosts.avg_cpe || 0.25).toFixed(2)),
          avgSuitabilityScore: Math.round(avgScore)
        },
        pipelineCounts,
        recentActivities
      });
    }

    // ==========================================
    // API: Campaigns (List, Create)
    // ==========================================
    if (pathname === '/api/campaigns' && method === 'GET') {
      const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
      const parsed = campaigns.map(c => ({
        ...c,
        key_features: JSON.parse(c.key_features || '[]'),
        mandatory_points: JSON.parse(c.mandatory_points || '[]'),
        dos_and_donts: JSON.parse(c.dos_and_donts || '{"dos":[], "donts":[]}')
      }));
      return sendJSON(res, { success: true, campaigns: parsed });
    }

    if (pathname === '/api/campaigns' && method === 'POST') {
      const body = await parseBody(req);
      const id = 'camp_' + randomUUID().substring(0, 8);
      const title = body.title || 'New boAt Campaign';
      const productName = body.product_name || 'boAt Audio';
      const category = body.category || 'Audio';
      const objective = body.objective || '';
      const budget = Number(body.budget) || 500000;
      const targetAudience = body.target_audience || 'Ages 18-30';
      const keyFeatures = JSON.stringify(body.key_features || []);
      const mandatoryPoints = JSON.stringify(body.mandatory_points || []);
      const dosAndDonts = JSON.stringify(body.dos_and_donts || { dos: [], donts: [] });
      const contentFormat = body.content_format || 'Instagram Reel';
      const startDate = body.start_date || new Date().toISOString().split('T')[0];
      const endDate = body.end_date || '';
      const bannerImg = body.banner_img || 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80';

      db.prepare(`
        INSERT INTO campaigns (id, title, product_name, category, objective, budget, target_audience, key_features, mandatory_points, dos_and_donts, content_format, status, start_date, end_date, banner_img)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, productName, category, objective, budget, targetAudience, keyFeatures, mandatoryPoints, dosAndDonts, contentFormat, 'Active', startDate, endDate, bannerImg);

      db.prepare(`
        INSERT INTO activity_logs (id, campaign_id, actor, action, details)
        VALUES (?, ?, 'Marketing Team', 'Campaign Created', ?)
      `).run(randomUUID(), id, `Created new campaign: ${title}`);

      return sendJSON(res, { success: true, id, message: 'Campaign created successfully' });
    }

    // ==========================================
    // API: Influencers (List, Filter, Search)
    // ==========================================
    if (pathname === '/api/influencers' && method === 'GET') {
      const category = parsedUrl.searchParams.get('category');
      const tier = parsedUrl.searchParams.get('tier');
      const status = parsedUrl.searchParams.get('status');
      const search = parsedUrl.searchParams.get('search');
      const minScore = parsedUrl.searchParams.get('minScore');

      let query = 'SELECT * FROM influencers WHERE 1=1';
      const params = [];

      if (category && category !== 'All') {
        query += ' AND category LIKE ?';
        params.push(`%${category}%`);
      }
      if (tier && tier !== 'All') {
        query += ' AND tier = ?';
        params.push(tier);
      }
      if (status && status !== 'All') {
        query += ' AND status = ?';
        params.push(status);
      }
      if (minScore) {
        query += ' AND suitability_score >= ?';
        params.push(Number(minScore));
      }
      if (search) {
        query += ' AND (name LIKE ? OR instagram_handle LIKE ? OR category LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY suitability_score DESC, follower_count DESC';

      const influencers = db.prepare(query).all(...params);
      const parsed = influencers.map(inf => ({
        ...inf,
        audience_demographics: JSON.parse(inf.audience_demographics || '{}'),
        content_samples: JSON.parse(inf.content_samples || '[]'),
        ai_evaluation: JSON.parse(inf.ai_evaluation_json || '{}')
      }));

      return sendJSON(res, { success: true, count: parsed.length, influencers: parsed });
    }

    // ==========================================
    // API: Influencer Onboarding / Application
    // ==========================================
    if (pathname === '/api/influencers' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.name || !body.instagram_handle || !body.email) {
        return sendError(res, 'Name, Email, and Instagram handle are required');
      }

      const handleClean = body.instagram_handle.replace(/^@/, '').trim().toLowerCase();
      const existing = db.prepare('SELECT id FROM influencers WHERE instagram_handle = ?').get(handleClean);
      const id = existing ? existing.id : 'inf_' + randomUUID().substring(0, 8);

      const followers = Number(body.follower_count) || 10000;
      let tier = 'Nano';
      if (followers >= 500000) tier = 'Macro';
      else if (followers >= 100000) tier = 'Mid-Tier';
      else if (followers >= 50000) tier = 'Micro';

      const influencerData = {
        id,
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone || '',
        instagram_handle: handleClean,
        youtube_channel: body.youtube_channel || null,
        follower_count: followers,
        engagement_rate: Number(body.engagement_rate) || 4.5,
        category: body.category || 'Lifestyle',
        tier,
        audience_demographics: JSON.stringify(body.audience_demographics || { male: 50, female: 50, age18_24: 65, age25_34: 25, topCity: 'Mumbai' }),
        content_samples: JSON.stringify(body.content_samples || []),
        previous_collaborations: body.previous_collaborations || '',
        preferred_products: body.preferred_products || 'ANC Earbuds, Smartwatches',
        commercial_rate: Number(body.commercial_rate) || 0,
        status: 'Applied',
        notes: body.notes || 'Submitted via boAt Public Influencer Onboarding Portal'
      };

      // Run AI Evaluation with 80+ Selection Rule
      const aiEval = evaluateInfluencer(influencerData);
      influencerData.suitability_score = aiEval.overallScore;
      influencerData.ai_evaluation_json = JSON.stringify(aiEval);

      // AI Decision: >=80 is Selected, <80 is Rejected
      const autoStatus = aiEval.overallScore >= 80 ? 'Selected' : 'Rejected';
      influencerData.status = autoStatus;

      if (existing) {
        db.prepare(`
          UPDATE influencers SET 
            name = ?, email = ?, phone = ?, follower_count = ?, engagement_rate = ?, 
            category = ?, tier = ?, audience_demographics = ?, content_samples = ?, 
            previous_collaborations = ?, preferred_products = ?, commercial_rate = ?, 
            status = ?, suitability_score = ?, ai_evaluation_json = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          influencerData.name, influencerData.email, influencerData.phone,
          influencerData.follower_count, influencerData.engagement_rate,
          influencerData.category, influencerData.tier, influencerData.audience_demographics,
          influencerData.content_samples, influencerData.previous_collaborations,
          influencerData.preferred_products, influencerData.commercial_rate,
          influencerData.status, influencerData.suitability_score,
          influencerData.ai_evaluation_json, influencerData.notes, id
        );
      } else {
        db.prepare(`
          INSERT INTO influencers (id, name, email, phone, instagram_handle, youtube_channel, follower_count, engagement_rate, category, tier, audience_demographics, content_samples, previous_collaborations, preferred_products, commercial_rate, status, suitability_score, ai_evaluation_json, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          influencerData.id, influencerData.name, influencerData.email, influencerData.phone,
          influencerData.instagram_handle, influencerData.youtube_channel,
          influencerData.follower_count, influencerData.engagement_rate,
          influencerData.category, influencerData.tier, influencerData.audience_demographics,
          influencerData.content_samples, influencerData.previous_collaborations,
          influencerData.preferred_products, influencerData.commercial_rate,
          influencerData.status, influencerData.suitability_score,
          influencerData.ai_evaluation_json, influencerData.notes
        );
      }

      // Automated Communication: Selected (>=80) vs Rejected (<80)
      const commId = 'comm_' + randomUUID().substring(0, 8);
      const isSelected = aiEval.overallScore >= 80;
      const commSubject = isSelected
        ? `boAt Creator Tribe - You are Selected! 🎯 (Score: ${aiEval.overallScore}/100)`
        : `boAt Creator Tribe - Application Status (Score: ${aiEval.overallScore}/100)`;
      const commBody = isSelected
        ? `Hi ${influencerData.name}!\n\nCongratulations! Based on our AI evaluation for profile genuineness, audience engagement, and boAt vibe alignment, your profile scored ${aiEval.overallScore}/100 (Threshold: 80+).\n\nYou have been automatically SELECTED to collaborate with boAt! Log into your creator portal to view active campaign briefs. #DoWhatFloatsYourBoAt`
        : `Hi ${influencerData.name},\n\nThank you for applying to the boAt Creator Tribe. Our AI evaluated your profile at ${aiEval.overallScore}/100, which does not meet our minimum 80-point qualification threshold for active boAt campaigns.\n\nWe have saved your details in our talent reserve for future launches.`;

      db.prepare(`
        INSERT INTO communications (id, influencer_id, type, channel, subject, body, status)
        VALUES (?, ?, ?, 'Email & WhatsApp', ?, ?, 'Sent')
      `).run(commId, id, isSelected ? 'Selection Notification' : 'Rejection Notification', commSubject, commBody);

      // Log activity
      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, actor, action, details)
        VALUES (?, ?, 'AI Engine', ?, ?)
      `).run(
        randomUUID(), id,
        isSelected ? 'Influencer Selected by AI (≥80)' : 'Influencer Rejected by AI (<80)',
        `Profile @${handleClean} scored ${aiEval.overallScore}/100. Status automatically set to: ${autoStatus}.`
      );

      return sendJSON(res, {
        success: true,
        influencerId: id,
        suitabilityScore: aiEval.overallScore,
        decision: autoStatus,
        status: autoStatus,
        matchGrade: aiEval.matchGrade,
        evaluation: aiEval,
        message: isSelected ? 'Profile verified & SELECTED by AI (Score ≥ 80)!' : 'Profile evaluated: Scored below 80 threshold (REJECTED).'
      });
    }

    // ==========================================
    // API: Trigger AI Evaluation on an Influencer
    // ==========================================
    if (pathname.match(/^\/api\/influencers\/([^/]+)\/evaluate$/) && method === 'POST') {
      const influencerId = pathname.split('/')[3];
      const inf = db.prepare('SELECT * FROM influencers WHERE id = ?').get(influencerId);
      if (!inf) return sendError(res, 'Influencer not found', 404);

      const body = await parseBody(req);
      let campaign = null;
      if (body.campaign_id) {
        campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(body.campaign_id);
      }

      const evaluation = evaluateInfluencer(inf, campaign);

      db.prepare(`
        UPDATE influencers SET 
          suitability_score = ?, 
          ai_evaluation_json = ?, 
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(evaluation.overallScore, JSON.stringify(evaluation), influencerId);

      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
        VALUES (?, ?, ?, 'AI Engine', 'Re-evaluation Completed', ?)
      `).run(randomUUID(), influencerId, campaign ? campaign.id : null, `Re-evaluated with score ${evaluation.overallScore}/100 (${evaluation.matchGrade})`);

      return sendJSON(res, {
        success: true,
        influencerId,
        evaluation
      });
    }

    // ==========================================
    // API: Update Influencer Pipeline Stage / Status
    // ==========================================
    if (pathname.match(/^\/api\/influencers\/([^/]+)\/status$/) && method === 'PATCH') {
      const influencerId = pathname.split('/')[3];
      const inf = db.prepare('SELECT * FROM influencers WHERE id = ?').get(influencerId);
      if (!inf) return sendError(res, 'Influencer not found', 404);

      const body = await parseBody(req);
      const newStatus = body.status;
      const campaignId = body.campaign_id || null;

      const validStatuses = [
        'Applied', 'Screening', 'Shortlisted', 'Contacted', 'Negotiation',
        'Selected', 'Brief Shared', 'Script Submitted', 'Script Approved',
        'Content Created', 'Published', 'Campaign Completed', 'Rejected'
      ];

      if (!validStatuses.includes(newStatus)) {
        return sendError(res, `Invalid status: ${newStatus}`);
      }

      db.prepare(`
        UPDATE influencers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newStatus, influencerId);

      // Automated Communication Trigger based on stage change
      let autoMessage = null;
      if (newStatus === 'Shortlisted') {
        autoMessage = {
          type: 'Selection Notification',
          subject: 'boAt Creator Tribe - You are Shortlisted! 🎯',
          body: `Hi ${inf.name}!\n\nCongratulations! You have been shortlisted for upcoming boAt product launches. Our team has reviewed your profile and would love to partner with you. We will be sharing the campaign details shortly.`
        };
      } else if (newStatus === 'Brief Shared') {
        autoMessage = {
          type: 'Campaign Brief Shared',
          subject: 'boAt Campaign Brief & Creative Guidelines 📋',
          body: `Hi ${inf.name}!\n\nYour campaign brief has been unlocked in your creator portal. Please review the mandatory communication points, product features, and dos & don'ts before submitting your video concept/script.`
        };
      } else if (newStatus === 'Rejected') {
        autoMessage = {
          type: 'Campaign Update',
          subject: 'boAt Creator Tribe - Profile Update',
          body: `Hi ${inf.name},\n\nThank you for your interest in collaborating with boAt. While your profile is not a direct fit for our active campaign requirements right now, we have saved your details for future launches.`
        };
      }

      if (autoMessage) {
        db.prepare(`
          INSERT INTO communications (id, influencer_id, campaign_id, type, channel, subject, body, status)
          VALUES (?, ?, ?, ?, 'Email & WhatsApp', ?, ?, 'Sent')
        `).run(randomUUID(), influencerId, campaignId, autoMessage.type, autoMessage.subject, autoMessage.body);
      }

      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
        VALUES (?, ?, ?, 'Marketing Team', 'Pipeline Stage Updated', ?)
      `).run(randomUUID(), influencerId, campaignId, `Stage changed from "${inf.status}" to "${newStatus}".`);

      return sendJSON(res, {
        success: true,
        influencerId,
        previousStatus: inf.status,
        newStatus,
        autoMessageSent: !!autoMessage
      });
    }

    // ==========================================
    // API: Scripts (List, Submit, Review)
    // ==========================================
    if (pathname === '/api/scripts' && method === 'GET') {
      const campaignId = parsedUrl.searchParams.get('campaign_id');
      const influencerId = parsedUrl.searchParams.get('influencer_id');

      let query = `
        SELECT s.*, i.name as influencer_name, i.instagram_handle, c.title as campaign_title, c.product_name
        FROM scripts s
        JOIN influencers i ON s.influencer_id = i.id
        JOIN campaigns c ON s.campaign_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (campaignId) {
        query += ' AND s.campaign_id = ?';
        params.push(campaignId);
      }
      if (influencerId) {
        query += ' AND s.influencer_id = ?';
        params.push(influencerId);
      }

      query += ' ORDER BY s.submitted_at DESC';

      const scripts = db.prepare(query).all(...params);
      const parsed = scripts.map(s => ({
        ...s,
        ai_audit: JSON.parse(s.ai_audit_json || '{}')
      }));

      return sendJSON(res, { success: true, count: parsed.length, scripts: parsed });
    }

    // Submit Script
    if (pathname === '/api/scripts' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.campaign_id || !body.influencer_id || !body.script_text) {
        return sendError(res, 'Campaign ID, Influencer ID, and script text are required');
      }

      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(body.campaign_id);
      if (!campaign) return sendError(res, 'Campaign not found', 404);

      const influencer = db.prepare('SELECT * FROM influencers WHERE id = ?').get(body.influencer_id);
      if (!influencer) return sendError(res, 'Influencer not found', 404);

      const scriptId = 'script_' + randomUUID().substring(0, 8);
      const conceptTitle = body.concept_title || `${campaign.product_name} Showcase`;
      const videoFormat = body.video_format || 'Instagram Reel (9:16 vertical)';
      const estimatedDuration = Number(body.estimated_duration_sec) || 45;

      // Run AI Compliance Audit
      const auditResult = auditScript(body.script_text, campaign);
      const isApproved = auditResult.isApproved;
      const scriptStatus = isApproved ? 'Approved' : 'Rejected';
      const influencerStage = isApproved ? 'Script Approved' : 'Selected';

      db.prepare(`
        INSERT INTO scripts (id, campaign_id, influencer_id, concept_title, script_text, video_format, estimated_duration_sec, status, ai_score, ai_audit_json, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        scriptId, body.campaign_id, body.influencer_id, conceptTitle,
        body.script_text, videoFormat, estimatedDuration, scriptStatus,
        auditResult.complianceScore, JSON.stringify(auditResult)
      );

      // Update influencer stage
      db.prepare(`
        UPDATE influencers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(influencerStage, body.influencer_id);

      // Automated Notification: Approved vs Rejected
      const scriptCommSubject = isApproved
        ? `boAt ${campaign.product_name} - Script Approved! 🚀`
        : `boAt ${campaign.product_name} - Script Rejected by AI (Requirements Not Met) ⚠️`;
      const scriptCommBody = isApproved
        ? `Hi ${influencer.name}!\n\nAwesome work! Your script "${conceptTitle}" has satisfied all mandatory product specifications (AI Score: ${auditResult.complianceScore}/100) and is APPROVED. You are cleared for production!`
        : `Hi ${influencer.name},\n\nYour submitted script "${conceptTitle}" has been REJECTED by our AI review because it does not meet the product requirements:\n\n${auditResult.checklist.filter(c => c.status === 'fail').map(c => '• ' + c.item + ': ' + c.detail).join('\n')}\n\nPlease revise your dialogue to include all mandatory specifications and re-submit.`;

      db.prepare(`
        INSERT INTO communications (id, influencer_id, campaign_id, type, channel, subject, body, status)
        VALUES (?, ?, ?, ?, 'Email & WhatsApp', ?, ?, 'Sent')
      `).run(randomUUID(), body.influencer_id, body.campaign_id, isApproved ? 'Script Approved' : 'Script Rejected', scriptCommSubject, scriptCommBody);

      // Log activity
      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
        VALUES (?, ?, ?, 'AI Engine', ?, ?)
      `).run(
        randomUUID(), body.influencer_id, body.campaign_id,
        isApproved ? 'Script Approved by AI' : 'Script Rejected by AI',
        `Script "${conceptTitle}" audited. Compliance Score: ${auditResult.complianceScore}/100 (${scriptStatus}).`
      );

      return sendJSON(res, {
        success: true,
        scriptId,
        isApproved,
        status: scriptStatus,
        auditResult,
        message: isApproved
          ? 'Script matches all product requirements and is APPROVED!'
          : 'Script REJECTED: Mandatory product specifications were not met. Revision required.'
      });
    }

    // Trigger AI Audit on existing Script
    if (pathname.match(/^\/api\/scripts\/([^/]+)\/ai-review$/) && method === 'POST') {
      const scriptId = pathname.split('/')[3];
      const script = db.prepare(`
        SELECT s.*, c.mandatory_points, c.key_features, c.product_name, c.id as camp_id
        FROM scripts s JOIN campaigns c ON s.campaign_id = c.id
        WHERE s.id = ?
      `).get(scriptId);

      if (!script) return sendError(res, 'Script not found', 404);

      const auditResult = auditScript(script.script_text, script);

      db.prepare(`
        UPDATE scripts SET ai_score = ?, ai_audit_json = ? WHERE id = ?
      `).run(auditResult.complianceScore, JSON.stringify(auditResult), scriptId);

      return sendJSON(res, { success: true, scriptId, auditResult });
    }

    // Marketing Team Decision on Script (Approve / Request Revision / Reject)
    if (pathname.match(/^\/api\/scripts\/([^/]+)\/decision$/) && method === 'PATCH') {
      const scriptId = pathname.split('/')[3];
      const script = db.prepare(`
        SELECT s.*, i.name as influencer_name, c.title as campaign_title, c.product_name
        FROM scripts s
        JOIN influencers i ON s.influencer_id = i.id
        JOIN campaigns c ON s.campaign_id = c.id
        WHERE s.id = ?
      `).get(scriptId);

      if (!script) return sendError(res, 'Script not found', 404);

      const body = await parseBody(req);
      const decision = body.decision; // 'Approved', 'Changes Requested', 'Rejected'
      const feedback = body.feedback || '';

      let newStatus = 'Submitted';
      let influencerStatus = 'Script Submitted';
      let commSubject = '';
      let commBody = '';

      if (decision === 'Approved') {
        newStatus = 'Approved';
        influencerStatus = 'Script Approved';
        commSubject = `boAt ${script.product_name} - Script Approved! 🚀`;
        commBody = `Hi ${script.influencer_name}!\n\nAwesome work—your script "${script.concept_title}" has been approved by the boAt Influencer Marketing team. You can now begin filming.\n\nTeam Note: ${feedback || 'Proceed with production per agreed guidelines.'}`;
      } else if (decision === 'Changes Requested') {
        newStatus = 'Changes Requested';
        influencerStatus = 'Script Submitted';
        commSubject = `boAt ${script.product_name} - Script Revision Needed 📝`;
        commBody = `Hi ${script.influencer_name}!\n\nThank you for submitting your script. We have a few revision points before we can greenlight production:\n\n${feedback}\n\nPlease update your script in the creator portal and re-submit.`;
      } else {
        newStatus = 'Rejected';
        influencerStatus = 'Selected';
        commSubject = `boAt ${script.product_name} - Script Concept Rejected`;
        commBody = `Hi ${script.influencer_name},\n\nThe submitted concept for ${script.product_name} does not align with our campaign guidelines. Please review the brief and submit a different concept.`;
      }

      db.prepare(`
        UPDATE scripts SET status = ?, team_feedback = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newStatus, feedback, scriptId);

      db.prepare(`
        UPDATE influencers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(influencerStatus, script.influencer_id);

      // Automated Communication
      db.prepare(`
        INSERT INTO communications (id, influencer_id, campaign_id, type, channel, subject, body, status)
        VALUES (?, ?, ?, ?, 'Email & WhatsApp', ?, ?, 'Sent')
      `).run(randomUUID(), script.influencer_id, script.campaign_id, `Script ${decision}`, commSubject, commBody);

      // Activity Log
      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
        VALUES (?, ?, ?, 'Team Reviewer', ?, ?)
      `).run(randomUUID(), script.influencer_id, script.campaign_id, `Script ${decision}`, `Script status set to ${newStatus}. Feedback: ${feedback}`);

      return sendJSON(res, {
        success: true,
        scriptId,
        newStatus,
        message: `Script marked as ${newStatus} and creator notified.`
      });
    }

    // ==========================================
    // API: Communications (Logs & Send)
    // ==========================================
    if (pathname === '/api/communications' && method === 'GET') {
      const comms = db.prepare(`
        SELECT c.*, i.name as influencer_name, i.instagram_handle, i.email as influencer_email, cp.title as campaign_title
        FROM communications c
        JOIN influencers i ON c.influencer_id = i.id
        LEFT JOIN campaigns cp ON c.campaign_id = cp.id
        ORDER BY c.sent_at DESC
      `).all();

      return sendJSON(res, { success: true, count: comms.length, communications: comms });
    }

    if (pathname === '/api/communications' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.influencer_id || !body.subject || !body.body) {
        return sendError(res, 'Influencer ID, subject, and body are required');
      }

      const id = 'comm_' + randomUUID().substring(0, 8);
      const channel = body.channel || 'Email';
      const type = body.type || 'Custom Notification';

      db.prepare(`
        INSERT INTO communications (id, influencer_id, campaign_id, type, channel, subject, body, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Sent')
      `).run(id, body.influencer_id, body.campaign_id || null, type, channel, body.subject, body.body);

      db.prepare(`
        INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
        VALUES (?, ?, ?, 'Marketing Team', 'Message Sent', ?)
      `).run(randomUUID(), body.influencer_id, body.campaign_id || null, `Sent ${channel} message: ${body.subject}`);

      return sendJSON(res, { success: true, id, message: 'Message sent successfully' });
    }

    // ==========================================
    // API: Campaign Performance & AI Analytics
    // ==========================================
    if (pathname === '/api/analytics' && method === 'GET') {
      const posts = db.prepare(`
        SELECT p.*, i.name as influencer_name, i.instagram_handle, i.follower_count, i.tier, i.commercial_rate, c.title as campaign_title, c.product_name
        FROM content_posts p
        JOIN influencers i ON p.influencer_id = i.id
        JOIN campaigns c ON p.campaign_id = c.id
        ORDER BY p.reach DESC
      `).all();

      const influencers = db.prepare('SELECT * FROM influencers').all();
      const insights = generateCampaignInsights(posts, influencers);

      return sendJSON(res, {
        success: true,
        posts,
        insights
      });
    }

    // ==========================================
    // API: Reset / Re-seed Data
    // ==========================================
    if (pathname === '/api/seed' && method === 'POST') {
      db.exec('DELETE FROM activity_logs;');
      db.exec('DELETE FROM content_posts;');
      db.exec('DELETE FROM communications;');
      db.exec('DELETE FROM scripts;');
      db.exec('DELETE FROM campaign_influencers;');
      db.exec('DELETE FROM influencers;');
      db.exec('DELETE FROM campaigns;');
      seedData();
      return sendJSON(res, { success: true, message: 'Database re-seeded with realistic boAt campaign data.' });
    }

    // ==========================================
    // Static Files (Frontend UI)
    // ==========================================
    if (method === 'GET' || method === 'HEAD') {
      let reqPath = pathname === '/' ? 'index.html' : pathname;
      return serveStatic(req, res, path.join(PUBLIC_DIR, reqPath));
    }

    sendError(res, 'Not Found', 404);
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    sendError(res, err.message || 'Internal Server Error', 500);
  }
});

// Start server on 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`⚓ boAt AI Influencer CRM & Campaign Automation Server`);
  console.log(`🚀 Live at: http://localhost:${PORT}`);
  console.log(`🚀 Direct IP: http://127.0.0.1:${PORT}`);
  console.log(`====================================================`);
});
