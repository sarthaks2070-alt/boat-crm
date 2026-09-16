// db.js - SQLite Database Layer for boAt Influencer CRM
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'boat_crm.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for performance & concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      objective TEXT NOT NULL,
      budget REAL DEFAULT 0,
      target_audience TEXT,
      key_features TEXT,
      mandatory_points TEXT,
      dos_and_donts TEXT,
      content_format TEXT,
      status TEXT DEFAULT 'Active',
      start_date TEXT,
      end_date TEXT,
      banner_img TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS influencers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      instagram_handle TEXT NOT NULL UNIQUE,
      youtube_channel TEXT,
      follower_count INTEGER NOT NULL,
      engagement_rate REAL NOT NULL,
      category TEXT NOT NULL,
      tier TEXT NOT NULL,
      audience_demographics TEXT,
      content_samples TEXT,
      previous_collaborations TEXT,
      preferred_products TEXT,
      commercial_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'Applied',
      suitability_score INTEGER DEFAULT 0,
      ai_evaluation_json TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaign_influencers (
      campaign_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      stage TEXT DEFAULT 'Selected',
      commercial_agreed REAL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (campaign_id, influencer_id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      concept_title TEXT NOT NULL,
      script_text TEXT NOT NULL,
      video_format TEXT NOT NULL,
      estimated_duration_sec INTEGER DEFAULT 45,
      status TEXT DEFAULT 'Submitted',
      ai_score INTEGER DEFAULT 0,
      ai_audit_json TEXT,
      team_feedback TEXT,
      version INTEGER DEFAULT 1,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL,
      campaign_id TEXT,
      type TEXT NOT NULL,
      channel TEXT DEFAULT 'Email',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'Sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_posts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      influencer_id TEXT NOT NULL,
      platform TEXT DEFAULT 'Instagram Reel',
      post_url TEXT NOT NULL,
      thumbnail_url TEXT,
      views INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      cpe REAL DEFAULT 0,
      published_date TEXT,
      ai_insights TEXT,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (influencer_id) REFERENCES influencers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      influencer_id TEXT,
      campaign_id TEXT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed sample data if empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM campaigns').get();
  if (!countRow || countRow.count === 0) {
    seedData();
  }
}

function seedData() {
  console.log('[DB] Seeding boAt CRM initial data...');

  const campaigns = [
    {
      id: 'camp_nirvana_ion',
      title: 'boAt Nirvana Ion ANC - Silence The Chaos',
      product_name: 'boAt Nirvana Ion ANC Earbuds',
      category: 'Audio / ANC',
      objective: 'Position Nirvana Ion ANC as the ultimate everyday noise cancellation earbuds for commuters, remote workers, and audiophiles under ₹3,000.',
      budget: 1500000,
      target_audience: 'Ages 18-32, Urban professionals, Metro commuters, College students, WFH creators',
      key_features: JSON.stringify([
        '32dB Active Noise Cancellation',
        'Crystal Bionic Sound powered by HiFi DSP',
        '120 Hours Monster Total Playback',
        'Quad Mics with ENx Technology for crystal-clear calls',
        'Dual EQ Modes (boAt Signature Sound & Balanced)'
      ]),
      mandatory_points: JSON.stringify([
        'Showcase real-world 32dB ANC before/after switch in a noisy environment',
        'Mention 120 Hours total battery life (no frequent charging hassle)',
        'Highlight ENx Quad Mics for outdoor calling without wind/traffic noise',
        'Include mandatory tag #SilenceTheChaos and #DoWhatFloatsYourBoAt',
        'CTA: Check link in bio / Use creator promo code for extra 10% off on boAt website'
      ]),
      dos_and_donts: JSON.stringify({
        dos: [
          'Shoot in high aesthetic vertical 9:16 format (Reel / YouTube Short)',
          'Demonstrate real ANC turning on with audio FX shift',
          'Keep tone bold, energetic, relatable, and authentic',
          'Wear earbuds properly with visible boAt logo'
        ],
        donts: [
          'Do NOT mention or compare directly against competitor brands by name (e.g. Sony, Apple, OnePlus)',
          'Do NOT claim earbuds are 100% waterproof for swimming (product is IPX4 splash proof)',
          'Avoid dull, reading-from-script monotonous tone',
          'Do not use copyrighted commercial music that will get muted'
        ]
      }),
      content_format: 'Instagram Reel (30-60s) & YouTube Short',
      status: 'Active',
      start_date: '2026-09-01',
      end_date: '2026-10-15',
      banner_img: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80'
    },
    {
      id: 'camp_wave_pro',
      title: 'boAt Wave Pro - Move in Style',
      product_name: 'boAt Wave Pro Smartwatch',
      category: 'Wearables / Fitness',
      objective: 'Promote boAt Wave Pro as the youth fitness and lifestyle companion with live cricket updates on wrist.',
      budget: 1000000,
      target_audience: 'Ages 16-28, Fitness enthusiasts, Cricket fans, College youth',
      key_features: JSON.stringify([
        '1.69 inch HD Color Display with 500 nits brightness',
        'Live Cricket Scores on your wrist',
        'ASAP Charge: 100% in 30 minutes',
        '15+ Sports Modes & Continuous Heart Rate/SpO2',
        'IP68 Sweat & Water Resistance'
      ]),
      mandatory_points: JSON.stringify([
        'Feature the Live Cricket Score update directly on screen',
        'Showcase ASAP Charge speed (30 mins full charge)',
        'Display stylish watch faces matching daily gym/streetwear fits',
        'Use #MoveInStyle and #boAtWave'
      ]),
      dos_and_donts: JSON.stringify({
        dos: ['Show workout tracking in action', 'Emphasize screen brightness under sunlight'],
        donts: ['Do not claim medical-grade clinical ECG diagnosis']
      }),
      content_format: 'Instagram Reel & Carousel',
      status: 'Active',
      start_date: '2026-09-10',
      end_date: '2026-10-30',
      banner_img: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80'
    },
    {
      id: 'camp_immortal_gaming',
      title: 'boAt Immortal 131 - Beast Mode Gaming',
      product_name: 'boAt Immortal 131 Gaming TWS',
      category: 'Gaming Audio',
      objective: 'Drive adoption among mobile esports gamers (BGMI, Free Fire, COD Mobile) with 40ms low latency Beast Mode.',
      budget: 1200000,
      target_audience: 'Ages 15-26, Mobile gamers, Esports streamers, Tech enthusiasts',
      key_features: JSON.stringify([
        '40ms Ultra Low Latency Beast Mode',
        'Blazing RGB LED lights on charging case',
        '40 Hours Total Playback with ASAP Charge',
        '10mm Dynamic Drivers tuned for footsteps and bass',
        'Touch controls with instant mode toggle'
      ]),
      mandatory_points: JSON.stringify([
        'Demonstrate zero audio lag during clutch gameplay moments',
        'Showcase the iconic futuristic RGB LEDs in dim/dark setup',
        'Mention 40ms Beast Mode toggle',
        'Tag #ImmortalGaming #BeastMode'
      ]),
      dos_and_donts: JSON.stringify({
        dos: ['Record screen game audio sync', 'Showcase cool desk setup lighting'],
        donts: ['Avoid fake claims of 0ms latency - clearly state 40ms']
      }),
      content_format: 'YouTube Short & Reel',
      status: 'Active',
      start_date: '2026-09-05',
      end_date: '2026-10-20',
      banner_img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80'
    },
    {
      id: 'camp_stone_1500',
      title: 'boAt Stone 1500 - Monster Bass Outdoor',
      product_name: 'boAt Stone 1500 Bluetooth Speaker',
      category: 'Audio / Speakers',
      objective: 'Position Stone 1500 as the ultimate rugged party speaker for hostel rooms, house parties, and outdoor trips.',
      budget: 800000,
      target_audience: 'Ages 18-30, College friends, Travel groups, Party hosts',
      key_features: JSON.stringify([
        '40W boAt Signature Sound with deep passive radiators',
        'TWS Feature: Pair 2 Stone 1500 for 80W stereo',
        'IPX6 Shock and Water Resistance',
        'Up to 15 Hours of Non-stop playback',
        'Dual EQ Modes: Indoor & Outdoor'
      ]),
      mandatory_points: JSON.stringify([
        'Demonstrate raw bass power outdoors or in party scenario',
        'Show rugged water splash resistance (IPX6)',
        'Mention 40W peak output and TWS pairing capability',
        'Use #SoundOfTheTribe #boAtStone'
      ]),
      dos_and_donts: JSON.stringify({
        dos: ['Vibrant upbeat party or rooftop vibe', 'Show physical bass vibration with water droplets'],
        donts: ['Do not submerge speaker completely in deep water (it is splash/spray resistant IPX6)']
      }),
      content_format: 'Instagram Reel (45s)',
      status: 'Active',
      start_date: '2026-08-20',
      end_date: '2026-10-05',
      banner_img: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80'
    }
  ];

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, title, product_name, category, objective, budget, target_audience, key_features, mandatory_points, dos_and_donts, content_format, status, start_date, end_date, banner_img)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of campaigns) {
    insertCampaign.run(
      c.id, c.title, c.product_name, c.category, c.objective, c.budget,
      c.target_audience, c.key_features, c.mandatory_points, c.dos_and_donts,
      c.content_format, c.status, c.start_date, c.end_date, c.banner_img
    );
  }

  const influencers = [
    {
      id: 'inf_1',
      name: 'Rohan Joshi',
      email: 'rohan@techrohan.in',
      phone: '+91 98201 44521',
      instagram_handle: 'techrohan',
      youtube_channel: 'TechWithRohan',
      follower_count: 450000,
      engagement_rate: 4.25,
      category: 'Tech Reviews',
      tier: 'Macro',
      audience_demographics: JSON.stringify({ male: 78, female: 22, age18_24: 55, age25_34: 38, topCity: 'Mumbai, Bengaluru, Delhi' }),
      content_samples: JSON.stringify(['https://instagram.com/p/reel1', 'https://youtube.com/shorts/sample1']),
      previous_collaborations: 'OnePlus, Asus ROG, RealMe, boAt (2025 Rockerz)',
      preferred_products: 'ANC Earbuds, Gaming Audio, Tech Wearables',
      commercial_rate: 75000,
      status: 'Script Approved',
      suitability_score: 94,
      ai_evaluation_json: JSON.stringify({
        overallScore: 94,
        matchGrade: 'Platinum Match',
        verdict: 'High-authority tech creator with exceptional credibility among urban youth gadget buyers.',
        parameterScores: {
          audienceRelevance: 96,
          engagementQuality: 90,
          brandCategoryFit: 98,
          credibilityReach: 95,
          contentAesthetics: 92,
          commercialViability: 88
        },
        strengths: [
          'High technical understanding of DSP and ANC decibel testing',
          'Audience actively makes purchase decisions based on his unboxings',
          'Consistent 4.2% engagement with low bot audit score (<3%)'
        ],
        drawbacks: ['Demands higher commercial rate', 'Requires strict 5-day lead time for production'],
        recommendedProducts: ['boAt Nirvana Ion ANC', 'boAt Immortal 131'],
        predictedCPE: 0.38
      }),
      notes: 'Reliable tech creator. Approved for Nirvana Ion ANC flagship reel.'
    },
    {
      id: 'inf_2',
      name: 'Tanvi Verma',
      email: 'tanvi@fitwithtanvi.com',
      phone: '+91 99302 11488',
      instagram_handle: 'fit_with_tanvi',
      youtube_channel: null,
      follower_count: 185000,
      engagement_rate: 5.80,
      category: 'Fitness & Health',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 42, female: 58, age18_24: 48, age25_34: 45, topCity: 'Delhi NCR, Pune, Chandigarh' }),
      content_samples: JSON.stringify(['https://instagram.com/p/reel2']),
      previous_collaborations: 'Cult.fit, Fast&Up, MyProtein',
      preferred_products: 'Smartwatches, Sport Earphones, TWS',
      commercial_rate: 35000,
      status: 'Published',
      suitability_score: 91,
      ai_evaluation_json: JSON.stringify({
        overallScore: 91,
        matchGrade: 'Platinum Match',
        verdict: 'Perfect alignment for Wave Pro fitness tracking and sweat resistance validation.',
        parameterScores: {
          audienceRelevance: 94,
          engagementQuality: 92,
          brandCategoryFit: 95,
          credibilityReach: 88,
          contentAesthetics: 90,
          commercialViability: 86
        },
        strengths: ['High female & fitness youth reach', 'Realistic gym sweat test reels perform exceptionally well'],
        drawbacks: ['Limited tech jargon familiarity; prefers lifestyle workout format'],
        recommendedProducts: ['boAt Wave Pro Smartwatch', 'boAt Rockerz 255 Pro+'],
        predictedCPE: 0.32
      }),
      notes: 'Published Wave Pro morning routine workout reel. Metrics tracking live.'
    },
    {
      id: 'inf_3',
      name: 'Kabir Mehra',
      email: 'kabir@mehraurban.com',
      phone: '+91 97115 88201',
      instagram_handle: 'kabir_lifestyle',
      youtube_channel: null,
      follower_count: 320000,
      engagement_rate: 3.90,
      category: 'Fashion & Lifestyle',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 60, female: 40, age18_24: 68, age25_34: 28, topCity: 'Mumbai, Jaipur, Ahmedabad' }),
      content_samples: JSON.stringify(['https://instagram.com/p/reel3']),
      previous_collaborations: 'Snitch, H&M India, Fossil',
      preferred_products: 'TWS, Smartwatches, Over-ear Headphones',
      commercial_rate: 45000,
      status: 'Script Submitted',
      suitability_score: 86,
      ai_evaluation_json: JSON.stringify({
        overallScore: 86,
        matchGrade: 'Gold Match',
        verdict: 'Great Gen-Z aesthetic appeal. Strong visual styling for everyday commuter wear.',
        parameterScores: {
          audienceRelevance: 88,
          engagementQuality: 82,
          brandCategoryFit: 90,
          credibilityReach: 87,
          contentAesthetics: 94,
          commercialViability: 80
        },
        strengths: ['Outstanding visual color grading and reel cinematography', 'High Gen-Z college follower base'],
        drawbacks: ['Occasionally misses technical spec callouts in lifestyle storytelling'],
        recommendedProducts: ['boAt Nirvana Ion ANC', 'boAt Rockerz 550'],
        predictedCPE: 0.44
      }),
      notes: 'Submitted Metro commute script for Nirvana Ion ANC. AI audited.'
    },
    {
      id: 'inf_4',
      name: 'Aarav Sharma',
      email: 'aarav@shadowgamers.in',
      phone: '+91 98450 33219',
      instagram_handle: 'aarav_gaming',
      youtube_channel: 'AaravPlaysBGMI',
      follower_count: 620000,
      engagement_rate: 6.10,
      category: 'Gaming',
      tier: 'Macro',
      audience_demographics: JSON.stringify({ male: 89, female: 11, age18_24: 75, age25_34: 20, topCity: 'Kolkata, Delhi, Hyderabad' }),
      content_samples: JSON.stringify(['https://youtube.com/shorts/gaming1']),
      previous_collaborations: 'RedBull India, Krafton, POCO',
      preferred_products: 'Gaming TWS, Low Latency Earphones',
      commercial_rate: 80000,
      status: 'Brief Shared',
      suitability_score: 96,
      ai_evaluation_json: JSON.stringify({
        overallScore: 96,
        matchGrade: 'Platinum Match',
        verdict: 'Top-tier esports match for boAt Immortal 131 with intense live gamer trust.',
        parameterScores: {
          audienceRelevance: 98,
          engagementQuality: 96,
          brandCategoryFit: 99,
          credibilityReach: 95,
          contentAesthetics: 90,
          commercialViability: 88
        },
        strengths: ['Diehard mobile gaming fanbase', 'Audience values sub-50ms audio latency immensely'],
        drawbacks: ['Requires live screen capture gameplay coordination'],
        recommendedProducts: ['boAt Immortal 131', 'boAt Immortal 200'],
        predictedCPE: 0.28
      }),
      notes: 'Brief dispatched for Immortal 131 Beast Mode clutch moments.'
    },
    {
      id: 'inf_5',
      name: 'Priya Patel',
      email: 'priya@campusvibes.in',
      phone: '+91 98980 12345',
      instagram_handle: 'priyacampusvibes',
      youtube_channel: null,
      follower_count: 85000,
      engagement_rate: 7.40,
      category: 'College & Youth',
      tier: 'Micro',
      audience_demographics: JSON.stringify({ male: 48, female: 52, age18_24: 88, age25_34: 10, topCity: 'Ahmedabad, Surat, Vadodara' }),
      content_samples: JSON.stringify(['https://instagram.com/p/priyareel']),
      previous_collaborations: 'Fastrack, Mamaearth Campus',
      preferred_products: 'Airdopes, Wave Smartwatches',
      commercial_rate: 15000,
      status: 'Shortlisted',
      suitability_score: 89,
      ai_evaluation_json: JSON.stringify({
        overallScore: 89,
        matchGrade: 'Gold Match',
        verdict: 'High ROI micro creator with ultra-high authentic college engagement (7.4%).',
        parameterScores: {
          audienceRelevance: 92,
          engagementQuality: 94,
          brandCategoryFit: 90,
          credibilityReach: 80,
          contentAesthetics: 84,
          commercialViability: 96
        },
        strengths: ['Extremely low Cost Per Engagement', 'Authentic relatable college campus scenarios'],
        drawbacks: ['Smaller absolute reach compared to macro creators'],
        recommendedProducts: ['boAt Wave Pro', 'boAt Airdopes 131'],
        predictedCPE: 0.24
      }),
      notes: 'Shortlisted for Wave Pro youth campaign. Great ROI prospect.'
    },
    {
      id: 'inf_6',
      name: 'Vikram Singhania',
      email: 'vikram@soundstudio.com',
      phone: '+91 98190 77412',
      instagram_handle: 'audiophile_vikram',
      youtube_channel: 'TheAudiophileLab',
      follower_count: 120000,
      engagement_rate: 4.80,
      category: 'Music & Audio',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 82, female: 18, age18_24: 40, age25_34: 52, topCity: 'Bengaluru, Mumbai, Chennai' }),
      content_samples: JSON.stringify(['https://youtube.com/shorts/audio1']),
      previous_collaborations: 'Sennheiser Studio, JBL Sound',
      preferred_products: 'ANC Earbuds, Bluetooth Speakers',
      commercial_rate: 30000,
      status: 'Selected',
      suitability_score: 88,
      ai_evaluation_json: JSON.stringify({
        overallScore: 88,
        matchGrade: 'Gold Match',
        verdict: 'Respected audio professional capable of breaking down boAt HiFi DSP and frequency curves.',
        parameterScores: {
          audienceRelevance: 90,
          engagementQuality: 88,
          brandCategoryFit: 92,
          credibilityReach: 85,
          contentAesthetics: 86,
          commercialViability: 82
        },
        strengths: ['High audiophile authority', 'Excellent microphone sound comparison checks'],
        drawbacks: ['May scrutinize ultra-low bass curve if not balanced'],
        recommendedProducts: ['boAt Nirvana Ion ANC', 'boAt Stone 1500'],
        predictedCPE: 0.35
      }),
      notes: 'Selected for Nirvana Ion ANC sound signature deep dive.'
    },
    {
      id: 'inf_7',
      name: 'Ananya Roy',
      email: 'ananya@wanderstories.com',
      phone: '+91 98300 55123',
      instagram_handle: 'ananyatravels',
      youtube_channel: null,
      follower_count: 290000,
      engagement_rate: 5.10,
      category: 'Travel & Outdoors',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 46, female: 54, age18_24: 52, age25_34: 42, topCity: 'Kolkata, Delhi, Bengaluru' }),
      content_samples: JSON.stringify(['https://instagram.com/p/travelreel']),
      previous_collaborations: 'Decathlon India, Wildcraft, MakeMyTrip',
      preferred_products: 'Bluetooth Speakers, ANC Headphones',
      commercial_rate: 40000,
      status: 'Content Created',
      suitability_score: 92,
      ai_evaluation_json: JSON.stringify({
        overallScore: 92,
        matchGrade: 'Platinum Match',
        verdict: 'Ideal creator to highlight Stone 1500 ruggedness and bonfire party vibes.',
        parameterScores: {
          audienceRelevance: 92,
          engagementQuality: 90,
          brandCategoryFit: 95,
          credibilityReach: 91,
          contentAesthetics: 95,
          commercialViability: 85
        },
        strengths: ['Breathtaking Himachal outdoor backdrops', 'High audience trust for travel gear'],
        drawbacks: ['High production turnaround time when travelling off-grid'],
        recommendedProducts: ['boAt Stone 1500', 'boAt Nirvana Ion ANC'],
        predictedCPE: 0.30
      }),
      notes: 'Content created at Manali campsite with Stone 1500. Under final publishing prep.'
    },
    {
      id: 'inf_8',
      name: 'Karan Malhotra',
      email: 'karan@malhotrabeats.com',
      phone: '+91 98210 99881',
      instagram_handle: 'karan_beats',
      youtube_channel: null,
      follower_count: 95000,
      engagement_rate: 6.50,
      category: 'Music & Audio',
      tier: 'Micro',
      audience_demographics: JSON.stringify({ male: 65, female: 35, age18_24: 70, age25_34: 25, topCity: 'Delhi, Chandigarh, Mumbai' }),
      content_samples: JSON.stringify(['https://instagram.com/p/karanbeats1']),
      previous_collaborations: 'boAt (2024 Stone), Pioneer DJ',
      preferred_products: 'Party Speakers, Bass Earphones',
      commercial_rate: 20000,
      status: 'Campaign Completed',
      suitability_score: 90,
      ai_evaluation_json: JSON.stringify({
        overallScore: 90,
        matchGrade: 'Platinum Match',
        verdict: 'Bass-heavy music producer whose audience aligns 100% with boAt Signature Sound.',
        parameterScores: {
          audienceRelevance: 95,
          engagementQuality: 92,
          brandCategoryFit: 96,
          credibilityReach: 82,
          contentAesthetics: 88,
          commercialViability: 92
        },
        strengths: ['Creates original viral remix audio for reels', 'Demonstrates live drops using boAt Stone 1500'],
        drawbacks: ['Focuses strictly on music and bass content'],
        recommendedProducts: ['boAt Stone 1500', 'boAt Rockerz 550'],
        predictedCPE: 0.22
      }),
      notes: 'Completed Stone 1500 drop remix campaign. Over 280k organic views generated.'
    },
    {
      id: 'inf_9',
      name: 'Simran Kaur',
      email: 'simran@streetglam.in',
      phone: '+91 98765 43210',
      instagram_handle: 'simran_fashion',
      youtube_channel: null,
      follower_count: 150000,
      engagement_rate: 3.20,
      category: 'Fashion & Lifestyle',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 30, female: 70, age18_24: 60, age25_34: 35, topCity: 'Ludhiana, Delhi, Mumbai' }),
      content_samples: JSON.stringify(['https://instagram.com/p/simran1']),
      previous_collaborations: 'Zara, Urbanic, Nykaa',
      preferred_products: 'Smartwatches, Pastel TWS',
      commercial_rate: 30000,
      status: 'Rejected',
      suitability_score: 74,
      ai_evaluation_json: JSON.stringify({
        overallScore: 74,
        matchGrade: 'Rejected (Score < 80)',
        verdict: 'REJECTED: Profile scored 74/100, which is below the mandatory 80-point boAt selection threshold. Community vibe or engagement does not meet criteria.',
        parameterScores: {
          audienceRelevance: 72,
          engagementQuality: 68,
          brandCategoryFit: 78,
          credibilityReach: 76,
          contentAesthetics: 88,
          commercialViability: 70
        },
        strengths: ['Aesthetic street fashion outfits matching pastel watch straps'],
        drawbacks: ['Failed minimum 80-point qualification threshold (Scored 74)', 'Engagement rate 3.2% is below boAt benchmark'],
        recommendedProducts: ['boAt Wave Pro', 'boAt Airdopes 141'],
        predictedCPE: 0.62
      }),
      notes: 'AI auto-rejected: Scored 74/100 (<80).'
    },
    {
      id: 'inf_10',
      name: 'Devansh Gupta',
      email: 'devansh@techsimplified.in',
      phone: '+91 99100 88224',
      instagram_handle: 'dev_gadgets',
      youtube_channel: 'DevGadgetsShorts',
      follower_count: 42000,
      engagement_rate: 8.20,
      category: 'Tech Reviews',
      tier: 'Nano',
      audience_demographics: JSON.stringify({ male: 85, female: 15, age18_24: 92, age25_34: 6, topCity: 'Kanpur, Lucknow, Patna' }),
      content_samples: JSON.stringify(['https://youtube.com/shorts/devgadget']),
      previous_collaborations: 'BoatCampusAmbo, Portronics',
      preferred_products: 'Immortal TWS, Airdopes, Fast Chargers',
      commercial_rate: 8000,
      status: 'Negotiation',
      suitability_score: 87,
      ai_evaluation_json: JSON.stringify({
        overallScore: 87,
        matchGrade: 'Gold Match',
        verdict: 'Ultra-engaged student tech creator with 8.2% viral reel retention.',
        parameterScores: {
          audienceRelevance: 90,
          engagementQuality: 96,
          brandCategoryFit: 88,
          credibilityReach: 74,
          contentAesthetics: 78,
          commercialViability: 98
        },
        strengths: ['Pocket-friendly budget creator with massive youth Tier-2 city reach'],
        drawbacks: ['Lower follower ceiling; best used in high-volume nano cohorts'],
        recommendedProducts: ['boAt Immortal 131', 'boAt Airdopes 131'],
        predictedCPE: 0.18
      }),
      notes: 'In negotiation for Immortal 131 student gaming creator bundle.'
    },
    {
      id: 'inf_11',
      name: 'Siddharth Nair',
      email: 'sid@campusdiaries.co',
      phone: '+91 98470 55112',
      instagram_handle: 'sid_vlogs',
      youtube_channel: null,
      follower_count: 25000,
      engagement_rate: 9.10,
      category: 'College & Youth',
      tier: 'Nano',
      audience_demographics: JSON.stringify({ male: 55, female: 45, age18_24: 94, age25_34: 4, topCity: 'Kochi, Thiruvananthapuram, Bengaluru' }),
      content_samples: JSON.stringify(['https://instagram.com/p/sidvlog1']),
      previous_collaborations: 'College Fest Partner',
      preferred_products: 'Airdopes, Wave Pro',
      commercial_rate: 5000,
      status: 'Contacted',
      suitability_score: 83,
      ai_evaluation_json: JSON.stringify({
        overallScore: 83,
        matchGrade: 'Gold Match',
        verdict: 'Promising campus nano-influencer with authentic Kerala college hostel following.',
        parameterScores: {
          audienceRelevance: 85,
          engagementQuality: 95,
          brandCategoryFit: 84,
          credibilityReach: 70,
          contentAesthetics: 76,
          commercialViability: 94
        },
        strengths: ['Extreme comment authenticity and friend-circle shares'],
        drawbacks: ['Early stage creator; requires script guidance'],
        recommendedProducts: ['boAt Wave Pro', 'boAt Nirvana Ion ANC'],
        predictedCPE: 0.20
      }),
      notes: 'Initial outreach sent via automated email.'
    },
    {
      id: 'inf_12',
      name: 'Neha Kapoor',
      email: 'neha@glambyneha.com',
      phone: '+91 98111 22334',
      instagram_handle: 'neha_glam',
      youtube_channel: null,
      follower_count: 210000,
      engagement_rate: 1.80,
      category: 'Beauty & Luxury',
      tier: 'Mid-Tier',
      audience_demographics: JSON.stringify({ male: 20, female: 80, age18_24: 35, age25_34: 55, topCity: 'Delhi NCR, Mumbai' }),
      content_samples: JSON.stringify(['https://instagram.com/p/nehaglam']),
      previous_collaborations: 'MAC, Sephora, Forest Essentials',
      preferred_products: 'Luxury Headphones',
      commercial_rate: 55000,
      status: 'Rejected',
      suitability_score: 48,
      ai_evaluation_json: JSON.stringify({
        overallScore: 48,
        matchGrade: 'Rejected (Score < 80)',
        verdict: 'REJECTED: Failed authenticity check. Bot/ghost follower risk flagged. boAt requires 100% genuine creator profiles.',
        parameterScores: {
          profileGenuineness: 35,
          brandVibeFit: 40,
          engagementQuality: 35,
          youthAesthetics: 45
        },
        strengths: ['High-resolution studio aesthetic'],
        drawbacks: [
          'CRITICAL: High bot/ghost follower risk flagged. Inauthentic interaction ratio.',
          'Audience is luxury skincare and makeup, not gadgets or fitness',
          'Failed minimum qualification threshold of 80 points (Scored 48)'
        ],
        recommendedProducts: [],
        botRisk: true,
        predictedCPE: 1.85
      }),
      notes: 'AI auto-rejected: Flagged for high bot risk and audience mismatch.'
    }
  ];

  const insertInfluencer = db.prepare(`
    INSERT INTO influencers (id, name, email, phone, instagram_handle, youtube_channel, follower_count, engagement_rate, category, tier, audience_demographics, content_samples, previous_collaborations, preferred_products, commercial_rate, status, suitability_score, ai_evaluation_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const inf of influencers) {
    insertInfluencer.run(
      inf.id, inf.name, inf.email, inf.phone, inf.instagram_handle, inf.youtube_channel,
      inf.follower_count, inf.engagement_rate, inf.category, inf.tier,
      inf.audience_demographics, inf.content_samples, inf.previous_collaborations,
      inf.preferred_products, inf.commercial_rate, inf.status, inf.suitability_score,
      inf.ai_evaluation_json, inf.notes
    );
  }

  // Seed scripts
  const scripts = [
    {
      id: 'script_1',
      campaign_id: 'camp_nirvana_ion',
      influencer_id: 'inf_1',
      concept_title: 'Noise Cancelling Reality Check: Mumbai Metro vs boAt Nirvana Ion ANC',
      script_text: `[HOOK - 0:00 to 0:05]
(Visual: Loud Mumbai local train rushing past, clattering noise at peak 85dB. Rohan is standing on platform looking directly into camera with overwhelmed expression.)
Rohan: "You think budget earbuds can actually block THIS madness? Let's find out."

[PROBLEM & INTRO - 0:05 to 0:15]
(Cut to close-up of boAt Nirvana Ion ANC case clicking open. Sleek metallic matte finish.)
Rohan: "Most brands promise Active Noise Cancellation, but give you weak digital filters. Today, we put the new boAt Nirvana Ion ANC to the ultimate torture test."

[ANC DEMONSTRATION & FEATURES - 0:15 to 0:32]
(Puts earbuds in. Rohan taps right earbud. AUDIO EFFECT: Metro roar drops by 80%, immediate calm ambient hum.)
Rohan: "Boom! That is 32dB Active Noise Cancellation powered by Crystal Bionic Sound and HiFi DSP. The screech of the train? Gone. Just my lo-fi playlist."
(Visual overlay showing animated waveform: 85dB -> 53dB drop).
Rohan: "And if someone calls you in this crowd? The Quad Mics with ENx Technology filter out the background chaos so your voice cuts through sharp and clear."

[BATTERY & VALUE - 0:32 to 0:42]
Rohan: "And the craziest part? 120 Hours of total playback. You can travel from Mumbai to Delhi and back without touching a charger."

[CTA & CONCLUSION - 0:42 to 0:50]
Rohan: "Premium silence without the premium price tag. Tap the link in my bio and use code ROHAN10 on the boAt website for an extra discount. #SilenceTheChaos #DoWhatFloatsYourBoAt"`,
      video_format: 'Instagram Reel (9:16 vertical, 50s)',
      estimated_duration_sec: 50,
      status: 'Approved',
      ai_score: 96,
      ai_audit_json: JSON.stringify({
        complianceScore: 96,
        status: 'Pass',
        verdict: 'Outstanding script! Perfectly incorporates all mandatory technical points with an energetic Gen-Z hook and authentic testing.',
        checklist: [
          { item: '32dB Active Noise Cancellation mentioned', status: 'pass', detail: 'Explicitly called out with before/after audio effect' },
          { item: '120 Hours Total Playback highlighted', status: 'pass', detail: 'Highlighted in battery comparison segment' },
          { item: 'ENx Quad Mics for clear calls included', status: 'pass', detail: 'Demonstrated in noisy metro commute context' },
          { item: 'Crystal Bionic Sound / HiFi DSP mentioned', status: 'pass', detail: 'Seamlessly woven into audio experience' },
          { item: 'Mandatory hashtags (#SilenceTheChaos, #DoWhatFloatsYourBoAt)', status: 'pass', detail: 'Both hashtags present in CTA' },
          { item: 'Clear Call to Action with Link / Code', status: 'pass', detail: 'CTA guides users to link in bio with promo code' },
          { item: 'Competitor bashing check', status: 'pass', detail: 'No competitor brands named directly' },
          { item: 'Misleading waterproof claims check', status: 'pass', detail: 'No false swimming claims made' }
        ],
        toneAnalysis: {
          energy: 'High (9/10)',
          genzRelatability: 'Very High (9.5/10)',
          clarity: 'Crisp & Informative (9.5/10)'
        },
        suggestedTweaks: [
          'Ensure the audio ducking effect during ANC activation is prominent so viewers wearing earphones feel the contrast.'
        ]
      }),
      team_feedback: 'Approved by boAt Marketing Team. Excellent pacing and creative audio transition.',
      version: 1,
      submitted_at: '2026-09-12 11:30:00',
      reviewed_at: '2026-09-12 14:15:00'
    },
    {
      id: 'script_2',
      campaign_id: 'camp_nirvana_ion',
      influencer_id: 'inf_3',
      concept_title: 'My Daily Metro Commute Outfit & Sound Check',
      script_text: `Hey guys! Getting ready for my college classes and today I am rocking this oversized vintage jacket paired with cargo pants. 
Also testing out my new boAt earphones! They look super cool in matte black.
I love listening to music on the metro because it cancels some noise and the sound is pretty loud and punchy.
They last really long too, haven't charged in days.
Check them out if you need cool earphones!`,
      video_format: 'Instagram Reel (30s)',
      estimated_duration_sec: 30,
      status: 'Rejected',
      ai_score: 58,
      ai_audit_json: JSON.stringify({
        complianceScore: 58,
        status: 'Rejected',
        verdict: 'REJECTED: Script fails mandatory product requirement standards. Lacks 32dB ANC, 120 Hours monster battery, and ENx Quad Mics callout.',
        checklist: [
          { item: '32dB Active Noise Cancellation mentioned', status: 'fail', detail: 'Script only says "cancels some noise" without naming 32dB ANC' },
          { item: '120 Hours Total Playback highlighted', status: 'fail', detail: 'Vaguely states "haven\'t charged in days" instead of the hero 120 Hours claim' },
          { item: 'ENx Quad Mics for clear calls included', status: 'fail', detail: 'Completely omitted calling / mic clarity' },
          { item: 'Crystal Bionic Sound / HiFi DSP mentioned', status: 'fail', detail: 'Not mentioned' },
          { item: 'Mandatory hashtags (#SilenceTheChaos, #DoWhatFloatsYourBoAt)', status: 'fail', detail: 'Both hashtags missing' },
          { item: 'Clear Call to Action with Link / Code', status: 'fail', detail: 'Vague CTA without link in bio mention' },
          { item: 'Competitor bashing check', status: 'pass', detail: 'Clean' },
          { item: 'Misleading claims check', status: 'pass', detail: 'Clean' }
        ],
        toneAnalysis: {
          energy: 'Moderate (6/10)',
          genzRelatability: 'High (8/10)',
          clarity: 'Casual, lacks product authority (5/10)'
        },
        suggestedTweaks: [
          'Add a line: "The 32dB Active Noise Cancellation completely cuts out metro rumble"',
          'Specify: "120 hours of battery life means you can go weeks between charges"',
          'Add mandatory CTA: "Link in bio! #SilenceTheChaos #DoWhatFloatsYourBoAt"'
        ]
      }),
      team_feedback: 'REJECTED BY AI & BRAND TEAM: Missing 32dB ANC spec, 120h battery, ENx mics, and required hashtags. Complete re-submission required.',
      version: 1,
      submitted_at: '2026-09-14 16:00:00',
      reviewed_at: '2026-09-15 10:20:00'
    }
  ];

  const insertScript = db.prepare(`
    INSERT INTO scripts (id, campaign_id, influencer_id, concept_title, script_text, video_format, estimated_duration_sec, status, ai_score, ai_audit_json, team_feedback, version, submitted_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of scripts) {
    insertScript.run(
      s.id, s.campaign_id, s.influencer_id, s.concept_title, s.script_text,
      s.video_format, s.estimated_duration_sec, s.status, s.ai_score,
      s.ai_audit_json, s.team_feedback, s.version, s.submitted_at, s.reviewed_at
    );
  }

  // Seed communications
  const comms = [
    {
      id: 'comm_1',
      influencer_id: 'inf_1',
      campaign_id: 'camp_nirvana_ion',
      type: 'Script Approved',
      channel: 'Email & WhatsApp',
      subject: 'boAt Nirvana Ion ANC - Your Script is Approved! 🚀',
      body: 'Hi Rohan! Great news—the boAt Influencer Marketing team has approved your script "Noise Cancelling Reality Check". AI Compliance Score: 96/100. Please proceed with production. Target publishing date: Sept 18th.',
      status: 'Sent',
      sent_at: '2026-09-12 14:16:00'
    },
    {
      id: 'comm_2',
      influencer_id: 'inf_3',
      campaign_id: 'camp_nirvana_ion',
      type: 'Script Revision Request',
      channel: 'Email & WhatsApp',
      subject: 'boAt Nirvana Ion ANC - Quick Script Revision Needed 📝',
      body: 'Hi Kabir, thanks for submitting! Our AI compliance scan flagged a few missing mandatory items (32dB ANC specification and #SilenceTheChaos hashtag). Please check the notes in your creator portal and submit a revised version.',
      status: 'Sent',
      sent_at: '2026-09-15 10:22:00'
    },
    {
      id: 'comm_3',
      influencer_id: 'inf_4',
      campaign_id: 'camp_immortal_gaming',
      type: 'Campaign Brief Dispatch',
      channel: 'Email',
      subject: 'Official Campaign Brief: boAt Immortal 131 #BeastMode 🔥',
      body: 'Hey Aarav! You have been selected for the boAt Immortal 131 Beast Mode campaign. The official brief with product specs, 40ms low latency gameplay guidelines, and mandatory points is now accessible in your CRM portal. Deadline for script submission: Sept 19th.',
      status: 'Sent',
      sent_at: '2026-09-15 11:00:00'
    },
    {
      id: 'comm_4',
      influencer_id: 'inf_11',
      campaign_id: null,
      type: 'Application Confirmation',
      channel: 'Email',
      subject: 'boAt Creator Tribe - Application Received! ⚓',
      body: 'Hey Siddharth! Thank you for applying to the boAt Creator Tribe. Our team and AI matching engine are reviewing your profile. We will be in touch shortly regarding upcoming launches.',
      status: 'Sent',
      sent_at: '2026-09-16 09:00:00'
    }
  ];

  const insertComm = db.prepare(`
    INSERT INTO communications (id, influencer_id, campaign_id, type, channel, subject, body, status, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const cm of comms) {
    insertComm.run(cm.id, cm.influencer_id, cm.campaign_id, cm.type, cm.channel, cm.subject, cm.body, cm.status, cm.sent_at);
  }

  // Seed live content posts
  const posts = [
    {
      id: 'post_1',
      campaign_id: 'camp_wave_pro',
      influencer_id: 'inf_2',
      platform: 'Instagram Reel',
      post_url: 'https://instagram.com/reel/tanvi_wavepro',
      thumbnail_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&q=80',
      views: 312000,
      reach: 265000,
      likes: 18900,
      comments: 680,
      shares: 1420,
      saves: 2950,
      clicks: 3420,
      conversions: 215,
      cpe: 0.28,
      published_date: '2026-09-13',
      ai_insights: 'Top performing fitness conversion reel. The ASAP 30-minute charging demo before her morning workout generated 42% of total link clicks.'
    },
    {
      id: 'post_2',
      campaign_id: 'camp_stone_1500',
      influencer_id: 'inf_8',
      platform: 'Instagram Reel',
      post_url: 'https://instagram.com/reel/karan_stone1500',
      thumbnail_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
      views: 284000,
      reach: 240000,
      likes: 21500,
      comments: 940,
      shares: 3100,
      saves: 1800,
      clicks: 1950,
      conversions: 140,
      cpe: 0.21,
      published_date: '2026-09-08',
      ai_insights: 'Viral audio remix usage. 1,200 other creators repurposed his original beat drop featuring the Stone 1500 bass vibration.'
    }
  ];

  const insertPost = db.prepare(`
    INSERT INTO content_posts (id, campaign_id, influencer_id, platform, post_url, thumbnail_url, views, reach, likes, comments, shares, saves, clicks, conversions, cpe, published_date, ai_insights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of posts) {
    insertPost.run(
      p.id, p.campaign_id, p.influencer_id, p.platform, p.post_url, p.thumbnail_url,
      p.views, p.reach, p.likes, p.comments, p.shares, p.saves, p.clicks,
      p.conversions, p.cpe, p.published_date, p.ai_insights
    );
  }

  // Seed activity logs
  const logs = [
    { id: 'log_1', influencer_id: 'inf_1', campaign_id: 'camp_nirvana_ion', actor: 'AI Engine', action: 'Evaluation Completed', details: 'Profile scored 94/100 (Platinum Match) for Audio/ANC.' },
    { id: 'log_2', influencer_id: 'inf_1', campaign_id: 'camp_nirvana_ion', actor: 'Team Lead', action: 'Script Approved', details: 'Approved script version 1 for production.' },
    { id: 'log_3', influencer_id: 'inf_3', campaign_id: 'camp_nirvana_ion', actor: 'AI Engine', action: 'Script Audit', details: 'Compliance score 58/100. Missing 32dB ANC and hashtags.' },
    { id: 'log_4', influencer_id: 'inf_12', campaign_id: null, actor: 'AI Engine', action: 'Bot Risk Flagged', details: 'Engagement rate 1.8% triggers low-authenticity warning.' },
    { id: 'log_5', influencer_id: 'inf_2', campaign_id: 'camp_wave_pro', actor: 'Automation', action: 'Content Published', details: 'Live reel tracked: 312k views, CPE ₹0.28.' }
  ];

  const insertLog = db.prepare(`
    INSERT INTO activity_logs (id, influencer_id, campaign_id, actor, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const l of logs) {
    insertLog.run(l.id, l.influencer_id, l.campaign_id, l.actor, l.action, l.details);
  }

  console.log('[DB] Seeding completed successfully.');
}

module.exports = {
  db,
  initSchema,
  seedData
};
