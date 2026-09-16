// app.js - Client-Side Controller for boAt AI Influencer CRM
let state = {
  activeRole: 'admin', // 'admin' | 'creator'
  currentView: 'view-dashboard',
  selectedCampaignId: 'all',
  influencers: [],
  campaigns: [],
  scripts: [],
  communications: [],
  analytics: null,
  activeStudioScript: null,
  pipelineViewMode: 'kanban',
  lastAcceptedInfluencerId: null
};

// Lifecycle Stages Mapping for Kanban Columns
const KANBAN_STAGES = [
  {
    id: 'stage_applied',
    title: 'Applied & Screening',
    color: '#3B82F6',
    statuses: ['Applied', 'Screening']
  },
  {
    id: 'stage_shortlisted',
    title: 'AI Selected (Score ≥ 80)',
    color: '#10B981',
    statuses: ['Shortlisted', 'Contacted', 'Negotiation', 'Selected']
  },
  {
    id: 'stage_brief',
    title: 'Brief Shared',
    color: '#00F0FF',
    statuses: ['Brief Shared']
  },
  {
    id: 'stage_script_review',
    title: 'Script In Review',
    color: '#F59E0B',
    statuses: ['Script Submitted']
  },
  {
    id: 'stage_approved',
    title: 'Script Approved',
    color: '#10B981',
    statuses: ['Script Approved', 'Content Created']
  },
  {
    id: 'stage_published',
    title: 'Published & Completed',
    color: '#FF1E2D',
    statuses: ['Published', 'Campaign Completed']
  },
  {
    id: 'stage_rejected',
    title: 'AI Rejected (< 80)',
    color: '#EF4444',
    statuses: ['Rejected']
  }
];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  fetchAllData();

  // Background real-time synchronization every 3.5 seconds
  setInterval(() => {
    fetchAllData(true);
  }, 3500);
});

// ===================================================
// Core Data Fetching & Sync
// ===================================================
async function fetchAllData(isBackgroundPoll = false) {
  try {
    const [statsRes, campRes, infRes, scRes, commRes, anaRes] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/campaigns'),
      fetch('/api/influencers'),
      fetch('/api/scripts'),
      fetch('/api/communications'),
      fetch('/api/analytics')
    ]);

    const [statsData, campData, infData, scData, commData, anaData] = await Promise.all([
      statsRes.json(),
      campRes.json(),
      infRes.json(),
      scRes.json(),
      commRes.json(),
      anaRes.json()
    ]);

    if (statsData.success) {
      state.stats = statsData.stats;
      state.pipelineCounts = statsData.pipelineCounts;
      state.recentActivities = statsData.recentActivities;
      renderStats(statsData.stats, statsData.pipelineCounts, statsData.recentActivities);
    }
    if (campData.success) {
      state.campaigns = campData.campaigns;
      renderCampaignsGrid();
    }
    if (infData.success) {
      state.influencers = infData.influencers;
      renderPipeline();
      renderEvalCreatorSelect();
      renderPriorityTable();
    }
    if (scData.success) {
      state.scripts = scData.scripts;
      renderScriptSelect();
      if (state.scripts.length > 0 && !state.activeStudioScript) {
        loadScriptIntoStudio(state.scripts[0].id);
      }
    }
    if (commData.success) {
      state.communications = commData.communications;
      if (state.currentView === 'view-communications') renderCommunicationsTable();
    }
    if (anaData.success) {
      state.analytics = anaData;
      if (state.currentView === 'view-analytics') renderAnalyticsView();
    }

    // Update selects now that both campaigns and influencers are guaranteed present
    renderCampaignSelects();
    updateNavCounts();

  } catch (err) {
    if (!isBackgroundPoll) {
      console.error('Error loading boAt CRM data:', err);
      showToast('Error syncing CRM data', 'error');
    }
  }
}

async function fetchStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  if (data.success) {
    state.stats = data.stats;
    state.pipelineCounts = data.pipelineCounts;
    state.recentActivities = data.recentActivities;
    renderStats(data.stats, data.pipelineCounts, data.recentActivities);
  }
}

async function fetchCampaigns() {
  const res = await fetch('/api/campaigns');
  const data = await res.json();
  if (data.success) {
    state.campaigns = data.campaigns;
    renderCampaignSelects();
    renderCampaignsGrid();
    updateNavCounts();
  }
}

async function fetchInfluencers() {
  const res = await fetch('/api/influencers');
  const data = await res.json();
  if (data.success) {
    state.influencers = data.influencers;
    renderPipeline();
    renderEvalCreatorSelect();
    renderPriorityTable();
    renderCampaignSelects();
    updateNavCounts();
  }
}

async function fetchScripts() {
  const res = await fetch('/api/scripts');
  const data = await res.json();
  if (data.success) {
    state.scripts = data.scripts;
    renderScriptSelect();
    if (state.scripts.length > 0 && !state.activeStudioScript) {
      loadScriptIntoStudio(state.scripts[0].id);
    }
    updateNavCounts();
  }
}

async function fetchCommunications() {
  const res = await fetch('/api/communications');
  const data = await res.json();
  if (data.success) {
    state.communications = data.communications;
    renderCommunicationsTable();
  }
}

async function fetchAnalytics() {
  const res = await fetch('/api/analytics');
  const data = await res.json();
  if (data.success) {
    state.analytics = data;
    renderAnalyticsView();
  }
}

function updateNavCounts() {
  const elPipe = document.getElementById('navPipelineCount');
  if (elPipe) elPipe.textContent = state.influencers.length;

  const elCamp = document.getElementById('navCampaignsCount');
  if (elCamp) elCamp.textContent = state.campaigns.length;

  const elSc = document.getElementById('navScriptsCount');
  if (elSc) {
    const pending = state.scripts.filter(s => s.status === 'Submitted' || s.status === 'Changes Requested').length;
    elSc.textContent = pending;
  }
}

// ===================================================
// View & Role Switchers
// ===================================================
function switchView(viewId) {
  state.currentView = viewId;
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-view') === viewId);
  });

  // Role highlight sync
  if (viewId === 'view-creator-portal') {
    setPortalRole('creator', false);
  } else {
    setPortalRole('admin', false);
  }

  // Refresh view specific components
  if (viewId === 'view-dashboard') {
    if (state.stats) renderStats(state.stats, state.pipelineCounts, state.recentActivities);
    renderPriorityTable();
  }
  if (viewId === 'view-pipeline') {
    renderPipeline();
  }
  if (viewId === 'view-scripts') {
    renderScriptSelect();
    if (state.scripts.length > 0) {
      const activeId = state.activeStudioScript?.id || state.scripts[0].id;
      loadScriptIntoStudio(activeId);
    }
  }
  if (viewId === 'view-ai-eval' && state.influencers.length > 0) {
    renderEvalCreatorSelect();
    const sel = document.getElementById('evalCreatorSelect');
    if (sel && sel.value) loadCreatorIntoEvalStudio(sel.value);
    else if (state.influencers[0]) loadCreatorIntoEvalStudio(state.influencers[0].id);
  }
  if (viewId === 'view-campaigns') renderCampaignsGrid();
  if (viewId === 'view-communications') renderCommunicationsTable();
  if (viewId === 'view-analytics') renderAnalyticsView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setPortalRole(role, autoNavigate = true) {
  state.activeRole = role;
  const btnAdmin = document.getElementById('btnRoleAdmin');
  const btnCreator = document.getElementById('btnRoleCreator');
  const adminNav = document.getElementById('adminNav');

  if (role === 'admin') {
    btnAdmin.classList.add('active');
    btnCreator.classList.remove('active');
    if (adminNav) adminNav.style.display = 'block';
    if (autoNavigate && state.currentView === 'view-creator-portal') {
      switchView('view-dashboard');
    }
  } else {
    btnCreator.classList.add('active');
    btnAdmin.classList.remove('active');
    if (adminNav) adminNav.style.display = 'none';
    if (autoNavigate) {
      switchView('view-creator-portal');
    }
  }
}

function onGlobalCampaignChange(campaignId) {
  state.selectedCampaignId = campaignId;
  filterInfluencers();
  showToast(`Filtered for: ${campaignId === 'all' ? 'All Campaigns' : campaignId}`, 'info');
}

// ===================================================
// Render: Executive Dashboard
// ===================================================
function renderStats(stats, pipelineCounts, recentActivities) {
  document.getElementById('kpiTotalInfluencers').textContent = stats.totalInfluencers;
  document.getElementById('kpiTotalReach').textContent = (stats.totalReach / 1000).toFixed(1) + 'K';
  document.getElementById('kpiAvgCpe').textContent = '₹' + stats.avgCpe.toFixed(2);
  document.getElementById('kpiAvgScore').innerHTML = `${stats.avgSuitabilityScore}<span style="font-size:1.1rem; color:var(--text-muted);">/100</span>`;
  document.getElementById('kpiScriptsReview').textContent = stats.scriptsInReview;

  // Render Lifecycle Funnel Steps
  const countsMap = {};
  if (pipelineCounts) {
    pipelineCounts.forEach(c => { countsMap[c.status] = c.count; });
  }

  const stagesList = [
    { label: 'Applied', status: 'Applied' },
    { label: 'Screening', status: 'Screening' },
    { label: 'Shortlisted', status: 'Shortlisted' },
    { label: 'Selected', status: 'Selected' },
    { label: 'Brief Shared', status: 'Brief Shared' },
    { label: 'Script Review', status: 'Script Submitted' },
    { label: 'Approved', status: 'Script Approved' },
    { label: 'Published', status: 'Published' }
  ];

  const funnelContainer = document.getElementById('funnelStepsContainer');
  if (funnelContainer) {
    funnelContainer.innerHTML = stagesList.map(st => `
      <div class="funnel-step" onclick="filterByStage('${st.status}')" style="cursor: pointer;">
        <div class="funnel-step-count">${countsMap[st.status] || 0}</div>
        <div class="funnel-step-label">${st.label}</div>
      </div>
    `).join('');
  }

  // Render Recent Activity Logs
  const actContainer = document.getElementById('dashActivityList');
  if (actContainer && recentActivities) {
    actContainer.innerHTML = recentActivities.map(act => `
      <div class="activity-item">
        <div class="activity-badge">${getActivityIcon(act.action)}</div>
        <div class="activity-content">
          <div class="activity-headline">${escapeHtml(act.action)}: ${escapeHtml(act.actor)}</div>
          <div class="activity-detail">${escapeHtml(act.details || '')}</div>
          <div class="activity-time">${formatDate(act.created_at)}</div>
        </div>
      </div>
    `).join('');
  }
}

function getActivityIcon(action) {
  if (action.includes('Approved')) return '✅';
  if (action.includes('Evaluat') || action.includes('Audit')) return '🧠';
  if (action.includes('Flagged') || action.includes('Bot')) return '⚠️';
  if (action.includes('Sent') || action.includes('Message')) return '✉️';
  if (action.includes('Created') || action.includes('Campaign')) return '🎯';
  return '⚡';
}

function renderPriorityTable() {
  const tbody = document.getElementById('dashPriorityTableBody');
  if (!tbody) return;

  const topCreators = [...state.influencers]
    .sort((a, b) => (b.suitability_score || 0) - (a.suitability_score || 0))
    .slice(0, 5);

  tbody.innerHTML = topCreators.map(inf => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div class="creator-avatar" style="width:32px; height:32px; font-size:0.75rem;">
            ${escapeHtml(inf.name.charAt(0))}
          </div>
          <div>
            <div style="font-weight:700; color:#FFF;">${escapeHtml(inf.name)}</div>
            <div style="font-size:0.74rem; color:var(--text-secondary);">@${escapeHtml(inf.instagram_handle)}</div>
          </div>
        </div>
      </td>
      <td><span class="tag-badge">${escapeHtml(inf.category)}</span></td>
      <td><strong>${formatNumber(inf.follower_count)}</strong></td>
      <td><strong style="color:var(--neon-green);">${inf.engagement_rate}%</strong></td>
      <td>${getScoreBadge(inf.suitability_score, inf.ai_evaluation?.matchGrade)}</td>
      <td><span class="status-pill ${getStatusClass(inf.status)}">${inf.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openAiEvalModal('${inf.id}')">
          Inspect AI Report
        </button>
      </td>
    </tr>
  `).join('');
}

// ===================================================
// Render: Pipeline (Kanban & Table Views)
// ===================================================
function renderPipeline() {
  const filtered = getFilteredInfluencers();

  if (state.pipelineViewMode === 'kanban') {
    document.getElementById('pipelineKanban').style.display = 'grid';
    document.getElementById('pipelineTable').style.display = 'none';
    renderKanbanBoard(filtered);
  } else {
    document.getElementById('pipelineKanban').style.display = 'none';
    document.getElementById('pipelineTable').style.display = 'block';
    renderTableView(filtered);
  }
}

function getFilteredInfluencers() {
  const search = (document.getElementById('pipelineSearch')?.value || '').toLowerCase();
  const category = document.getElementById('filterCategory')?.value || 'All';
  const tier = document.getElementById('filterTier')?.value || 'All';
  const minScore = Number(document.getElementById('filterMinScore')?.value || 0);

  return state.influencers.filter(inf => {
    if (search) {
      const matchName = inf.name.toLowerCase().includes(search);
      const matchHandle = inf.instagram_handle.toLowerCase().includes(search);
      const matchCat = inf.category.toLowerCase().includes(search);
      if (!matchName && !matchHandle && !matchCat) return false;
    }
    if (category !== 'All' && !inf.category.toLowerCase().includes(category.toLowerCase())) return false;
    if (tier !== 'All' && inf.tier !== tier) return false;
    if (minScore > 0 && (inf.suitability_score || 0) < minScore) return false;
    return true;
  });
}

function filterInfluencers() {
  renderPipeline();
}

function filterByStage(status) {
  switchView('view-pipeline');
  const searchInput = document.getElementById('pipelineSearch');
  if (searchInput) searchInput.value = '';
  // Set table/kanban view
  renderPipeline();
}

function setPipelineViewMode(mode) {
  state.pipelineViewMode = mode;
  document.getElementById('btnViewKanban').classList.toggle('active', mode === 'kanban');
  document.getElementById('btnViewTable').classList.toggle('active', mode === 'table');
  renderPipeline();
}

function renderKanbanBoard(influencers) {
  const kanban = document.getElementById('pipelineKanban');
  if (!kanban) return;

  kanban.innerHTML = KANBAN_STAGES.map(stage => {
    const stageInfluencers = influencers.filter(inf => stage.statuses.includes(inf.status));

    return `
      <div class="kanban-column" style="--col-color: ${stage.color};">
        <div class="column-header">
          <div class="column-title-group">
            <div class="column-dot"></div>
            <div class="column-title">${stage.title}</div>
          </div>
          <div class="column-count">${stageInfluencers.length}</div>
        </div>

        <div class="column-cards">
          ${stageInfluencers.length === 0 ? `
            <div style="text-align:center; padding: 2rem 1rem; color: var(--text-muted); font-size:0.8rem;">
              No creators in this stage
            </div>
          ` : stageInfluencers.map(inf => `
            <div class="creator-card" onclick="openAiEvalModal('${inf.id}')">
              <div class="creator-card-header">
                <div class="creator-avatar">
                  ${escapeHtml(inf.name.charAt(0))}
                </div>
                <div class="creator-info">
                  <div class="creator-name">${escapeHtml(inf.name)}</div>
                  <div class="creator-handle">@${escapeHtml(inf.instagram_handle)}</div>
                </div>
                ${getScoreBadge(inf.suitability_score, inf.ai_evaluation?.matchGrade)}
              </div>

              <div class="creator-stats-row">
                <div class="stat-item">
                  <span class="stat-label">Followers</span>
                  <span class="stat-val">${formatNumber(inf.follower_count)}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Eng. Rate</span>
                  <span class="stat-val" style="color:var(--neon-green);">${inf.engagement_rate}%</span>
                </div>
              </div>

              <div class="creator-badges-row">
                <span class="tag-badge">${escapeHtml(inf.category)}</span>
                <span class="tag-badge">${inf.tier}</span>
                ${inf.ai_evaluation?.botRisk ? `
                  <span class="bot-alert-tag">⚠️ Bot Suspicion</span>
                ` : ''}
              </div>

              <div class="card-action-row" onclick="event.stopPropagation();">
                <span class="status-pill ${getStatusClass(inf.status)}" style="font-size:0.68rem; padding:0.15rem 0.45rem;">
                  ${inf.status}
                </span>
                ${getNextStageButton(inf)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getNextStageButton(inf) {
  if (inf.status === 'Applied' || inf.status === 'Screening') {
    return `<button class="btn btn-primary btn-sm" onclick="advanceInfluencerStage('${inf.id}', 'Shortlisted')">⭐ Shortlist</button>`;
  }
  if (inf.status === 'Shortlisted' || inf.status === 'Contacted' || inf.status === 'Negotiation') {
    return `<button class="btn btn-primary btn-sm" onclick="advanceInfluencerStage('${inf.id}', 'Selected')">🤝 Select</button>`;
  }
  if (inf.status === 'Selected') {
    return `<button class="btn btn-secondary btn-sm" onclick="advanceInfluencerStage('${inf.id}', 'Brief Shared')">📋 Share Brief</button>`;
  }
  if (inf.status === 'Brief Shared') {
    return `<button class="btn btn-secondary btn-sm" onclick="openCreatorWorkspaceSection('${inf.id}')">✍️ Submit Script</button>`;
  }
  if (inf.status === 'Script Submitted') {
    return `<button class="btn btn-warning btn-sm" onclick="openScriptInStudioByInfluencer('${inf.id}')">📝 Review</button>`;
  }
  if (inf.status === 'Script Approved') {
    return `<button class="btn btn-success btn-sm" onclick="advanceInfluencerStage('${inf.id}', 'Published')">🚀 Mark Published</button>`;
  }
  if (inf.status === 'Rejected') {
    return `<button class="btn btn-secondary btn-sm" onclick="reEvaluateCreator('${inf.id}')">🔄 Re-Evaluate</button>`;
  }
  return `<button class="btn btn-secondary btn-sm" onclick="openAiEvalModal('${inf.id}')">Inspect</button>`;
}

async function advanceInfluencerStage(influencerId, newStatus) {
  try {
    const res = await fetch(`/api/influencers/${influencerId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Creator moved to "${newStatus}"! Notification triggered.`, 'success');
      fetchAllData();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch (err) {
    showToast('Network error updating stage', 'error');
  }
}

function renderTableView(influencers) {
  const tbody = document.getElementById('pipelineTableBody');
  if (!tbody) return;

  tbody.innerHTML = influencers.map(inf => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="creator-avatar" style="width:36px; height:36px;">
            ${escapeHtml(inf.name.charAt(0))}
          </div>
          <div>
            <div style="font-weight:700; color:#FFF;">${escapeHtml(inf.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">@${escapeHtml(inf.instagram_handle)}</div>
          </div>
        </div>
      </td>
      <td><span class="tag-badge">${escapeHtml(inf.category)}</span></td>
      <td><strong>${formatNumber(inf.follower_count)}</strong></td>
      <td><strong style="color:var(--neon-green);">${inf.engagement_rate}%</strong></td>
      <td>${inf.ai_evaluation?.botRisk ? '<span class="status-pill status-rejected">⚠️ High Bot Risk</span>' : '<span class="status-pill status-selected">✅ 98% Authentic</span>'}</td>
      <td>${getScoreBadge(inf.suitability_score, inf.ai_evaluation?.matchGrade)}</td>
      <td><span class="status-pill ${getStatusClass(inf.status)}">${inf.status}</span></td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openAiEvalModal('${inf.id}')">Inspect AI</button>
          ${getNextStageButton(inf)}
        </div>
      </td>
    </tr>
  `).join('');
}

// ===================================================
// Render: AI Evaluation Studio
// ===================================================
function renderEvalCreatorSelect() {
  const sel = document.getElementById('evalCreatorSelect');
  if (!sel) return;

  const currentVal = sel.value;
  sel.innerHTML = '<option value="">Select an Influencer to inspect...</option>' +
    state.influencers.map(inf => `
      <option value="${inf.id}" ${inf.id === currentVal ? 'selected' : ''}>
        ${escapeHtml(inf.name)} (@${escapeHtml(inf.instagram_handle)}) - Score: ${inf.suitability_score}/100
      </option>
    `).join('');
}

function loadCreatorIntoEvalStudio(influencerId) {
  const inf = state.influencers.find(i => i.id === influencerId);
  if (!inf) return;

  const container = document.getElementById('evalStudioContent');
  if (!container) return;

  const ai = inf.ai_evaluation || {};
  const params = ai.parameterScores || {};
  const genuineness = params.profileGenuineness ?? params.credibilityReach ?? (ai.botRisk ? 35 : 94);
  const vibe = params.brandVibeFit ?? params.brandCategoryFit ?? 90;
  const engagement = params.engagementQuality ?? 85;
  const youth = params.youthAesthetics ?? params.audienceRelevance ?? 82;
  const isSelected = (inf.suitability_score || 0) >= 80;

  container.innerHTML = `
    <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-xl); padding:1.75rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:1rem;">
          <div class="creator-avatar" style="width:58px; height:58px; font-size:1.4rem;">
            ${escapeHtml(inf.name.charAt(0))}
          </div>
          <div>
            <h2 style="color:#FFF; font-size:1.4rem; font-weight:800;">${escapeHtml(inf.name)}</h2>
            <div style="color:var(--text-secondary); font-size:0.88rem; display:flex; gap:0.75rem; align-items:center;">
              <span>@${escapeHtml(inf.instagram_handle)}</span>
              <span>•</span>
              <span>${escapeHtml(inf.category)}</span>
              <span>•</span>
              <span>Tier: ${inf.tier}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.75rem;">
          <button class="btn btn-secondary" onclick="reEvaluateCreator('${inf.id}')">
            🔄 Re-Run AI Evaluation
          </button>
          ${inf.status === 'Rejected' ? `
            <button class="btn btn-secondary btn-sm" onclick="advanceInfluencerStage('${inf.id}', 'Selected')">
              ⚠️ Manual Override to Select
            </button>
          ` : `
            <button class="btn btn-primary" onclick="advanceInfluencerStage('${inf.id}', 'Selected')">
              ⭐ Confirm Selection
            </button>
          `}
        </div>
      </div>

      <div class="ai-report-grid">
        <!-- Score Hero -->
        <div class="score-hero-box">
          <div class="score-circle">
            <span class="score-circle-num">${inf.suitability_score || 0}</span>
            <span class="score-circle-label">boAt Fit</span>
          </div>
          <div class="score-hero-badge ${isSelected ? 'score-platinum' : 'score-mismatch'}">
            ${isSelected ? '✅ Selected (Score ≥ 80)' : '❌ Rejected (Score < 80)'}
          </div>
          <div class="score-hero-verdict">
            "${escapeHtml(ai.verdict || 'Creator evaluated against profile genuineness, boAt community vibe, and engagement parameters.')}"
          </div>

          <div style="margin-top:0.75rem; display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; width:100%; border-top:1px solid var(--boat-border); padding-top:0.75rem; font-size:0.8rem;">
            <div>
              <span style="color:var(--text-muted); font-size:0.72rem; display:block;">STATUS</span>
              <strong style="color:${isSelected ? 'var(--neon-green)' : '#EF4444'}; font-size:0.95rem;">
                ${isSelected ? 'Selected (≥80)' : 'Rejected (<80)'}
              </strong>
            </div>
            <div>
              <span style="color:var(--text-muted); font-size:0.72rem; display:block;">GENUINENESS AUDIT</span>
              <strong style="color:${ai.botRisk ? '#EF4444' : 'var(--neon-green)'}; font-size:0.95rem;">
                ${ai.botRisk ? '⚠️ High Bot Risk' : '✅ 98% Authentic'}
              </strong>
            </div>
          </div>
        </div>

        <!-- 4 Core AI Parameters -->
        <div class="ai-parameters-box">
          <div style="font-weight:700; color:#FFF; font-size:0.95rem; margin-bottom:0.25rem; display:flex; justify-content:space-between; align-items:center;">
            <span>📊 AI Evaluation Criteria (80+ to Pass)</span>
            <span class="status-pill ${isSelected ? 'status-selected' : 'status-rejected'}" style="font-size:0.72rem;">
              ${isSelected ? 'QUALIFIED' : 'DISQUALIFIED'}
            </span>
          </div>

          ${renderParamBar('Profile Genuineness & Bot Audit (30% weight)', genuineness)}
          ${renderParamBar('boAt Brand Vibe & Community Synergy (35% weight)', vibe)}
          ${renderParamBar('Audience Engagement & Retention (20% weight)', engagement)}
          ${renderParamBar('Youth Demographics & Content Aesthetics (15% weight)', youth)}
        </div>
      </div>

      <!-- Strengths & Drawbacks & boAt Recommendations -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-top:1.5rem; border-top:1px solid var(--boat-border); padding-top:1.5rem;">
        <div style="background:var(--boat-surface); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1rem;">
          <div style="font-weight:700; color:var(--neon-green); font-size:0.88rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
            <span>✨</span> Key Strengths for boAt
          </div>
          <ul style="padding-left:1.2rem; font-size:0.82rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.35rem;">
            ${(ai.strengths || ['High authentic engagement rate']).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>

        <div style="background:var(--boat-surface); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1rem;">
          <div style="font-weight:700; color:var(--neon-amber); font-size:0.88rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;">
            <span>⚠️</span> Considerations & Drawbacks
          </div>
          <ul style="padding-left:1.2rem; font-size:0.82rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.35rem;">
            ${(ai.drawbacks || ['Requires strict delivery timeline agreement']).map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div style="margin-top:1.2rem; background:rgba(255, 30, 45, 0.08); border:1px solid rgba(255, 30, 45, 0.25); border-radius:var(--radius-md); padding:0.85rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <span style="font-weight:700; color:#FFF; font-size:0.88rem;">Recommended boAt Product Match:</span>
          <span style="color:#FFA4A9; font-size:0.88rem; margin-left:0.5rem; font-weight:600;">
            ${(ai.recommendedProducts || ['boAt Nirvana Ion ANC', 'boAt Wave Pro']).join(' • ')}
          </span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="sendCampaignBriefToCreator('${inf.id}')">
          Dispatched Campaign Brief →
        </button>
      </div>
    </div>
  `;
}

function renderParamBar(label, value) {
  return `
    <div class="param-row">
      <div class="param-header">
        <span>${label}</span>
        <span style="color:#FFF;">${value || 80}/100</span>
      </div>
      <div class="param-bar-bg">
        <div class="param-bar-fill" style="width: ${value || 80}%;"></div>
      </div>
    </div>
  `;
}

async function reEvaluateCreator(influencerId) {
  try {
    const res = await fetch(`/api/influencers/${influencerId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: state.selectedCampaignId !== 'all' ? state.selectedCampaignId : null })
    });
    const data = await res.json();
    if (data.success) {
      showToast('AI Re-Evaluation complete!', 'success');
      await fetchInfluencers();
      loadCreatorIntoEvalStudio(influencerId);
    }
  } catch (err) {
    showToast('Failed to evaluate creator', 'error');
  }
}

// ===================================================
// Render: AI Script Review & Approval Studio
// ===================================================
function renderScriptSelect() {
  const sel = document.getElementById('scriptSelect');
  if (!sel) return;

  sel.innerHTML = state.scripts.map(s => `
    <option value="${s.id}">
      ${escapeHtml(s.concept_title)} (${s.influencer_name} - ${s.status})
    </option>
  `).join('');
}

function loadScriptIntoStudio(scriptId) {
  const s = state.scripts.find(sc => sc.id === scriptId);
  if (!s) return;

  state.activeStudioScript = s;
  const sel = document.getElementById('scriptSelect');
  if (sel) sel.value = s.id;

  document.getElementById('scriptStudioConceptTitle').textContent = s.concept_title;
  document.getElementById('scriptStudioCreatorName').textContent = `${s.influencer_name} (@${s.instagram_handle})`;
  document.getElementById('scriptStudioCampaignTitle').textContent = s.campaign_title || 'boAt Campaign';
  document.getElementById('scriptStudioFormat').textContent = s.video_format;
  document.getElementById('scriptStudioTextarea').value = s.script_text;
  document.getElementById('teamFeedbackInput').value = s.team_feedback || '';

  const badge = document.getElementById('scriptStudioStatusBadge');
  badge.className = `status-pill ${getStatusClass(s.status)}`;
  badge.textContent = s.status;

  renderScriptAuditReport(s.ai_audit, s.ai_score);
}

function openScriptInStudioByInfluencer(influencerId) {
  switchView('view-scripts');
  const scr = state.scripts.find(s => s.influencer_id === influencerId);
  if (scr) loadScriptIntoStudio(scr.id);
}

function renderScriptAuditReport(audit, score) {
  const card = document.getElementById('scriptAuditReportCard');
  if (!card) return;

  if (!audit || !audit.checklist) {
    card.innerHTML = `
      <div style="text-align:center; padding: 2rem 1rem; color:var(--text-muted);">
        Click "Re-Audit with AI" to scan this script.
      </div>
    `;
    return;
  }

  const statusColor = audit.status === 'Pass' ? 'var(--neon-green)' : audit.status === 'Warning' ? 'var(--neon-amber)' : '#EF4444';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--boat-border); padding-bottom:1rem;">
      <div>
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">AI COMPLIANCE SCAN</div>
        <div style="font-size:1.3rem; font-weight:800; color:#FFF; display:flex; align-items:center; gap:0.5rem;">
          <span>Compliance Score:</span>
          <span style="color:${statusColor};">${score || audit.complianceScore}/100</span>
        </div>
      </div>
      <div class="score-hero-badge" style="background:rgba(255,255,255,0.05); border:1px solid ${statusColor}; color:${statusColor}; font-size:0.85rem;">
        ${audit.status || 'Audited'}
      </div>
    </div>

    <!-- Tone Analysis -->
    <div style="background:var(--boat-surface); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:0.75rem 1rem; display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; text-align:center;">
      <div>
        <span style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; display:block;">Energy Tone</span>
        <strong style="font-size:0.8rem; color:#FFF;">${audit.toneAnalysis?.energy || 'High'}</strong>
      </div>
      <div>
        <span style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; display:block;">Gen-Z Relatability</span>
        <strong style="font-size:0.8rem; color:var(--neon-green);">${audit.toneAnalysis?.genzRelatability || 'Very High'}</strong>
      </div>
      <div>
        <span style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; display:block;">Pacing & Clarity</span>
        <strong style="font-size:0.8rem; color:#FFF;">${audit.toneAnalysis?.clarity || 'Crisp'}</strong>
      </div>
    </div>

    <!-- Audit Checklist -->
    <div style="font-weight:700; color:#FFF; font-size:0.88rem; margin-top:0.25rem;">
      ✅ Campaign Specifications & Compliance Checklist
    </div>

    <div class="script-checklist" style="max-height: 240px; overflow-y: auto;">
      ${(audit.checklist || []).map(ch => `
        <div class="check-item">
          <div class="check-icon ${ch.status === 'pass' ? 'check-pass' : ch.status === 'warn' ? 'check-warn' : 'check-fail'}">
            ${ch.status === 'pass' ? '✓' : ch.status === 'warn' ? '!' : '✕'}
          </div>
          <div>
            <div style="font-weight:700; color:#FFF; font-size:0.82rem;">${escapeHtml(ch.item)}</div>
            <div style="color:var(--text-secondary); font-size:0.75rem;">${escapeHtml(ch.detail || '')}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Suggested Improvements -->
    <div style="background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.25); border-radius:var(--radius-md); padding:0.75rem 1rem;">
      <div style="font-weight:700; color:var(--neon-amber); font-size:0.82rem; margin-bottom:0.35rem;">
        💡 AI Suggested Script Tweaks:
      </div>
      <ul style="padding-left:1.2rem; font-size:0.78rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
        ${(audit.suggestedTweaks || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
      </ul>
    </div>
  `;
}

async function triggerScriptAiAudit() {
  if (!state.activeStudioScript) return;
  const scriptText = document.getElementById('scriptStudioTextarea').value;

  try {
    const res = await fetch(`/api/scripts/${state.activeStudioScript.id}/ai-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script_text: scriptText })
    });
    const data = await res.json();
    if (data.success) {
      showToast('AI Script Audit Completed!', 'success');
      renderScriptAuditReport(data.auditResult, data.auditResult.complianceScore);
      fetchScripts();
    }
  } catch (err) {
    showToast('Failed to audit script', 'error');
  }
}

async function decideScript(decision) {
  if (!state.activeStudioScript) return;
  const feedback = document.getElementById('teamFeedbackInput').value;

  try {
    const res = await fetch(`/api/scripts/${state.activeStudioScript.id}/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, feedback })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, decision === 'Approved' ? 'success' : 'info');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to record decision', 'error');
  }
}

// ===================================================
// Render: Campaigns & Creative Briefs
// ===================================================
function renderCampaignSelects() {
  const globalSel = document.getElementById('globalCampaignSelect');
  if (globalSel) {
    const current = globalSel.value || 'all';
    globalSel.innerHTML = '<option value="all">🔥 All Active Campaigns</option>' +
      state.campaigns.map(c => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('');
    if (current) globalSel.value = current;
  }

  const creatorSel = document.getElementById('creatorActiveCampaignSelect');
  if (creatorSel) {
    const currentCamp = creatorSel.value;
    creatorSel.innerHTML = state.campaigns.map(c => `
      <option value="${c.id}" ${c.id === currentCamp ? 'selected' : ''}>${escapeHtml(c.title)} (${escapeHtml(c.product_name)})</option>
    `).join('');
    if (currentCamp && state.campaigns.some(c => c.id === currentCamp)) {
      creatorSel.value = currentCamp;
      onCreatorBriefChange(currentCamp);
    } else if (state.campaigns.length > 0) {
      creatorSel.value = state.campaigns[0].id;
      onCreatorBriefChange(state.campaigns[0].id);
    }
  }

  const creatorInfSel = document.getElementById('creatorActiveInfluencerSelect');
  if (creatorInfSel) {
    const currentInf = creatorInfSel.value || state.lastAcceptedInfluencerId;
    const acceptedOnly = state.influencers.filter(i => 
      i.status !== 'Rejected' && (i.suitability_score >= 80 || i.status === 'Selected' || i.status === 'Brief Shared' || i.status === 'Script Submitted' || i.status === 'Script Approved' || i.status === 'Content Created' || i.status === 'Published' || i.status === 'Campaign Completed')
    );
    creatorInfSel.innerHTML = acceptedOnly.map(i => `
      <option value="${i.id}" ${i.id === currentInf ? 'selected' : ''}>${escapeHtml(i.name)} (@${escapeHtml(i.instagram_handle)}) - Approved</option>
    `).join('');

    if (currentInf && acceptedOnly.some(i => i.id === currentInf)) {
      creatorInfSel.value = currentInf;
    } else if (acceptedOnly.length > 0) {
      creatorInfSel.value = acceptedOnly[0].id;
    }
  }

  const msgRecSel = document.getElementById('msgRecipientSelect');
  if (msgRecSel) {
    const curMsgVal = msgRecSel.value;
    msgRecSel.innerHTML = state.influencers.map(i => `
      <option value="${i.id}" ${i.id === curMsgVal ? 'selected' : ''}>${escapeHtml(i.name)} (@${escapeHtml(i.instagram_handle)})</option>
    `).join('');
    if (curMsgVal) msgRecSel.value = curMsgVal;
  }
}

function renderCampaignsGrid() {
  const container = document.getElementById('campaignsGridContainer');
  if (!container) return;

  container.innerHTML = state.campaigns.map(c => `
    <div class="campaign-card">
      <div class="campaign-hero" style="background-image: url('${c.banner_img}');">
        <span class="campaign-badge">${escapeHtml(c.category)}</span>
        <span class="status-pill status-script-approved">${c.status}</span>
      </div>

      <div class="campaign-body">
        <div class="campaign-title">${escapeHtml(c.title)}</div>
        <div style="font-size:0.8rem; color:var(--boat-red); font-weight:700;">Hero Product: ${escapeHtml(c.product_name)}</div>
        <div class="campaign-desc">${escapeHtml(c.objective)}</div>

        <div style="background:var(--boat-surface); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:0.75rem; margin-top:0.25rem;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:0.35rem;">Mandatory Communication Points:</div>
          <ul style="padding-left:1.1rem; font-size:0.78rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
            ${(c.mandatory_points || []).slice(0, 3).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--boat-border); font-size:0.82rem;">
          <span>Budget: <strong style="color:#FFF;">₹${(c.budget || 0).toLocaleString('en-IN')}</strong></span>
          <button class="btn btn-secondary btn-sm" onclick="openCampaignBriefModal('${c.id}')">
            View Creative Brief →
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function openCampaignBriefModal(campaignId) {
  const c = state.campaigns.find(camp => camp.id === campaignId);
  if (!c) return;

  document.getElementById('modalBriefTitle').textContent = c.title;
  document.getElementById('modalBriefProduct').textContent = `Product: ${c.product_name} (${c.category})`;

  const modalBody = document.getElementById('modalBriefBody');
  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1rem;">
        <h4 style="color:#FFF; font-size:0.95rem; margin-bottom:0.35rem;">🎯 Campaign Objective</h4>
        <p style="color:var(--text-secondary); font-size:0.85rem;">${escapeHtml(c.objective)}</p>
      </div>

      <div>
        <h4 style="color:#FFF; font-size:0.95rem; margin-bottom:0.5rem;">⚡ Key Product Features</h4>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          ${(c.key_features || []).map(f => `<span class="tag-badge" style="background:var(--boat-surface); color:#FFF;">${escapeHtml(f)}</span>`).join('')}
        </div>
      </div>

      <div style="background:rgba(255, 30, 45, 0.08); border:1px solid rgba(255, 30, 45, 0.25); border-radius:var(--radius-md); padding:1rem;">
        <h4 style="color:#FFA4A9; font-size:0.95rem; margin-bottom:0.5rem;">🚨 Mandatory Communication Points</h4>
        <ul style="padding-left:1.2rem; font-size:0.84rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.35rem;">
          ${(c.mandatory_points || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1rem;">
          <h4 style="color:var(--neon-green); font-size:0.88rem; margin-bottom:0.35rem;">✅ Dos</h4>
          <ul style="padding-left:1.1rem; font-size:0.8rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
            ${(c.dos_and_donts?.dos || []).map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>

        <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1rem;">
          <h4 style="color:#EF4444; font-size:0.88rem; margin-bottom:0.35rem;">❌ Don'ts</h4>
          <ul style="padding-left:1.1rem; font-size:0.8rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
            ${(c.dos_and_donts?.donts || []).map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;

  openModal('modalCampaignBrief');
}

// ===================================================
// Render: Communications
// ===================================================
function renderCommunicationsTable() {
  const tbody = document.getElementById('commsTableBody');
  if (!tbody) return;

  tbody.innerHTML = state.communications.map(cm => `
    <tr>
      <td>
        <div style="font-weight:700; color:#FFF;">${escapeHtml(cm.influencer_name || 'Creator')}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">@${escapeHtml(cm.instagram_handle || '')}</div>
      </td>
      <td><span class="tag-badge">${escapeHtml(cm.type)}</span></td>
      <td>
        <span style="font-size:0.8rem; color:${cm.channel.includes('WhatsApp') ? 'var(--neon-green)' : 'var(--neon-cyan)'};">
          ${cm.channel.includes('WhatsApp') ? '📱' : '📧'} ${escapeHtml(cm.channel)}
        </span>
      </td>
      <td style="font-weight:600; color:#FFF;">${escapeHtml(cm.subject)}</td>
      <td style="color:var(--text-secondary); font-size:0.8rem; max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${escapeHtml(cm.body)}
      </td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${formatDate(cm.sent_at)}</td>
      <td><span class="status-pill status-script-approved">${cm.status}</span></td>
    </tr>
  `).join('');
}

// ===================================================
// Render: Performance & Analytics
// ===================================================
function renderAnalyticsView() {
  const container = document.getElementById('analyticsContainer');
  if (!container || !state.analytics) return;

  const m = state.analytics.insights?.metrics || {};
  const posts = state.analytics.posts || [];
  const strategicInsights = state.analytics.insights?.strategicInsights || [];

  container.innerHTML = `
    <!-- Top Metric Cards -->
    <div class="kpi-grid" style="margin-bottom:1.5rem;">
      <div class="kpi-card" style="--accent-color: #00F0FF;">
        <div class="kpi-header"><span>Verified Impressions</span><div class="kpi-icon">👁️</div></div>
        <div class="kpi-value">${(m.totalViews || 596000).toLocaleString('en-IN')}</div>
        <div class="kpi-meta">Across Reels & Shorts</div>
      </div>

      <div class="kpi-card" style="--accent-color: #10B981;">
        <div class="kpi-header"><span>Blended Engagement Rate</span><div class="kpi-icon">❤️</div></div>
        <div class="kpi-value">${m.blendedER || 5.4}%</div>
        <div class="kpi-meta"><span class="trend-up">↑ 1.8%</span> above tech benchmark</div>
      </div>

      <div class="kpi-card" style="--accent-color: #F59E0B;">
        <div class="kpi-header"><span>Cost Per Engagement</span><div class="kpi-icon">🪙</div></div>
        <div class="kpi-value">₹${m.blendedCPE || 0.25}</div>
        <div class="kpi-meta">Cost efficiency rating: A+</div>
      </div>

      <div class="kpi-card" style="--accent-color: #A855F7;">
        <div class="kpi-header"><span>Campaign ROI Multiplier</span><div class="kpi-icon">📈</div></div>
        <div class="kpi-value">${m.roiMultiplier || 3.4}x</div>
        <div class="kpi-meta">Estimated sales revenue: ₹${((m.estimatedRevenue || 887000) / 100000).toFixed(1)}L</div>
      </div>
    </div>

    <!-- AI Strategic Insights -->
    <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-xl); padding:1.5rem; margin-bottom:1.5rem;">
      <h3 style="color:#FFF; font-size:1.15rem; font-weight:800; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
        <span>🧠</span> AI Post-Campaign Strategic Intelligence
      </h3>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
        ${strategicInsights.map(item => `
          <div style="background:var(--boat-surface); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:1.2rem;">
            <span class="tag-badge" style="background:rgba(255,30,45,0.15); color:#FF5A65; margin-bottom:0.6rem; display:inline-block;">
              ${escapeHtml(item.badge)}
            </span>
            <div style="font-weight:700; color:#FFF; font-size:0.92rem; margin-bottom:0.35rem;">
              ${escapeHtml(item.headline)}
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
              ${escapeHtml(item.body)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Content Performance Table -->
    <div class="card-panel">
      <div class="card-panel-title">
        <span>🎬 Live Published Content Performance Breakdown</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Influencer</th>
              <th>Campaign</th>
              <th>Platform</th>
              <th>Verified Views</th>
              <th>Reach</th>
              <th>Engagements (Likes/Saves)</th>
              <th>Clicks & Conversions</th>
              <th>Realized CPE</th>
              <th>AI Performance Insight</th>
            </tr>
          </thead>
          <tbody>
            ${posts.map(p => {
              const engs = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
              return `
                <tr>
                  <td>
                    <div style="font-weight:700; color:#FFF;">${escapeHtml(p.influencer_name)}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">@${escapeHtml(p.instagram_handle)}</div>
                  </td>
                  <td><span class="tag-badge">${escapeHtml(p.product_name)}</span></td>
                  <td>${escapeHtml(p.platform)}</td>
                  <td><strong>${formatNumber(p.views)}</strong></td>
                  <td>${formatNumber(p.reach)}</td>
                  <td>
                    <div style="font-weight:700; color:var(--neon-green);">${formatNumber(engs)}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">${formatNumber(p.saves)} saves</div>
                  </td>
                  <td>
                    <div><strong>${formatNumber(p.clicks)}</strong> clicks</div>
                    <div style="font-size:0.72rem; color:var(--neon-cyan);">${p.conversions} orders</div>
                  </td>
                  <td><strong style="color:var(--neon-green);">₹${p.cpe}</strong></td>
                  <td style="font-size:0.78rem; color:var(--text-secondary); max-width:260px;">${escapeHtml(p.ai_insights || 'Strong retention.')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===================================================
// Public Creator Portal Logic
// ===================================================
async function handlePublicOnboardSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('btnSubmitApplication');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing Profile with AI...';

  const payload = {
    name: document.getElementById('formName').value.trim(),
    instagram_handle: document.getElementById('formHandle').value.trim(),
    email: document.getElementById('formEmail').value.trim(),
    phone: document.getElementById('formPhone').value.trim(),
    follower_count: document.getElementById('formFollowers').value,
    engagement_rate: document.getElementById('formER').value,
    category: document.getElementById('formCategory').value,
    commercial_rate: 0,
    preferred_products: document.getElementById('formPreferredProducts').value.trim(),
    previous_collaborations: document.getElementById('formPastCollabs').value.trim()
  };

  try {
    const res = await fetch('/api/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      const isAccepted = data.evaluation.isSelected || data.evaluation.overallScore >= 80;
      renderApplicationAiResult(data.evaluation, payload.name, data.influencerId);

      if (isAccepted) {
        state.lastAcceptedInfluencerId = data.influencerId;
      } else {
        state.lastAcceptedInfluencerId = null;
      }

      // Fetch and sync all CRM data immediately
      await fetchAllData();

      const wsSection = document.getElementById('creatorWorkspaceSection');
      const lockedBanner = document.getElementById('creatorWorkspaceLockedBanner');

      if (isAccepted) {
        renderCampaignSelects();
        const sel = document.getElementById('creatorActiveInfluencerSelect');
        if (sel) sel.value = data.influencerId;

        if (wsSection) wsSection.style.display = 'block';
        if (lockedBanner) lockedBanner.style.display = 'none';

        showToast('🎉 Application ACCEPTED by AI (Score ≥ 80)! Collaboration Workspace Unlocked.', 'success');
      } else {
        if (wsSection) wsSection.style.display = 'none';
        if (lockedBanner) {
          lockedBanner.style.display = 'block';
          lockedBanner.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 0.35rem;">🔒</div>
            <h3 style="color: #EF4444; font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem;">
              Workspace Locked — Profile Not Accepted
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 550px; margin: 0 auto 1rem auto; line-height: 1.5;">
              Your profile scored <strong>${data.evaluation.overallScore}/100</strong>, which is below the mandatory 80-point qualification threshold. 
              The Creator Collaboration Workspace and Script Submitter are available only to accepted creators.
            </p>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('creatorApplicationCard').scrollIntoView({behavior:'smooth'})">
              Review Application Guidelines Above
            </button>
          `;
        }
        showToast('Profile not accepted (Score < 80). Workspace remains locked.', 'warning');
      }
    } else {
      showToast(data.error || 'Submission failed', 'error');
    }
  } catch (err) {
    console.error('Network error during application submission:', err);
    showToast('Network error during application submission', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Submit Application & Run Instant AI Match';
  }
}

function renderApplicationAiResult(evaluation, name, influencerId = null) {
  const box = document.getElementById('applicationAiResult');
  if (!box) return;

  const isSelected = evaluation.isSelected || evaluation.overallScore >= 80;
  const statusBadge = isSelected
    ? '<span class="status-pill status-selected" style="font-size:0.85rem; padding:0.3rem 0.8rem;">✅ AI SELECTED (Score ≥ 80)</span>'
    : '<span class="status-pill status-rejected" style="font-size:0.85rem; padding:0.3rem 0.8rem;">❌ AI REJECTED (Score < 80)</span>';

  box.style.display = 'block';
  box.innerHTML = `
    <div style="background:var(--boat-surface); border:2px solid ${isSelected ? 'var(--neon-green)' : 'var(--boat-red)'}; border-radius:var(--radius-lg); padding:1.5rem; text-align:center;">
      <div style="font-size:2.2rem; margin-bottom:0.35rem;">${isSelected ? '🎉' : '⚠️'}</div>
      <h3 style="color:#FFF; font-size:1.25rem; font-weight:800; margin-bottom:0.35rem;">
        ${isSelected ? `Congratulations & Welcome to the Tribe, ${escapeHtml(name)}!` : `Application Status: Not Selected, ${escapeHtml(name)}`}
      </h3>
      <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1rem;">
        ${isSelected 
          ? 'Your profile passed the AI evaluation! Your Collaboration Workspace & Script Submitter has unlocked below.' 
          : 'Evaluated by boAt AI Engine against Profile Genuineness, Community Vibe, and Engagement:'}
      </p>

      <div style="display:inline-flex; align-items:center; gap:0.75rem; background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:999px; padding:0.45rem 1.3rem; margin-bottom:1rem;">
        <span style="font-size:1.4rem; font-weight:900; color:${isSelected ? 'var(--neon-green)' : '#EF4444'};">${evaluation.overallScore}/100</span>
        ${statusBadge}
      </div>

      <p style="font-size:0.85rem; color:${isSelected ? '#6EE7B7' : '#FCA5A5'}; max-width:580px; margin:0 auto 1.25rem auto; line-height:1.5;">
        "${escapeHtml(evaluation.verdict)}"
      </p>

      <div style="display:flex; justify-content:center; gap:0.75rem;">
        ${isSelected ? `
          <button class="btn btn-primary btn-sm" onclick="openCreatorWorkspaceSection('${escapeHtml(influencerId || '')}')">
            Enter Collaboration Workspace &amp; Submit Script ↓
          </button>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('creatorApplicationCard').scrollIntoView({behavior:'smooth'})">
            Review Guidelines &amp; Re-Apply
          </button>
        `}
      </div>
    </div>
  `;
}

function openCreatorWorkspaceSection(influencerId = null) {
  switchView('view-creator-portal');
  const section = document.getElementById('creatorWorkspaceSection');
  const lockedBanner = document.getElementById('creatorWorkspaceLockedBanner');

  const targetId = influencerId || state.lastAcceptedInfluencerId;

  if (targetId) {
    const inf = state.influencers.find(i => i.id === targetId);
    const isAccepted = (targetId === state.lastAcceptedInfluencerId) ||
      (inf && inf.status !== 'Rejected' && (inf.suitability_score >= 80 || inf.status === 'Selected' || inf.status === 'Brief Shared' || inf.status === 'Script Submitted' || inf.status === 'Script Approved' || inf.status === 'Content Created' || inf.status === 'Published' || inf.status === 'Campaign Completed'));

    if (isAccepted) {
      if (section) section.style.display = 'block';
      if (lockedBanner) lockedBanner.style.display = 'none';

      renderCampaignSelects();
      const sel = document.getElementById('creatorActiveInfluencerSelect');
      if (sel) sel.value = targetId;

      section?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
  }

  // Check if workspace is already unlocked
  if (section && section.style.display === 'block') {
    section.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Otherwise, lock and redirect user to application form
  if (section) section.style.display = 'none';
  if (lockedBanner) lockedBanner.style.display = 'block';
  showToast('🔒 Complete the application form above. Workspace unlocks once AI accepts your profile (Score ≥ 80)!', 'info');
  const appCard = document.getElementById('creatorApplicationCard');
  if (appCard) appCard.scrollIntoView({ behavior: 'smooth' });
}

function onCreatorBriefChange(campaignId) {
  const c = state.campaigns.find(camp => camp.id === campaignId);
  const box = document.getElementById('creatorBriefDisplayBox');
  if (!box || !c) return;

  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
      <div>
        <h4 style="color:#FFF; font-size:1.1rem; font-weight:800;">${escapeHtml(c.title)}</h4>
        <div style="font-size:0.82rem; color:var(--boat-red); font-weight:700;">Target Product: ${escapeHtml(c.product_name)}</div>
      </div>
      <span class="tag-badge" style="background:var(--boat-surface-card);">${escapeHtml(c.content_format)}</span>
    </div>

    <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:0.75rem;">${escapeHtml(c.objective)}</p>

    <div style="background:rgba(255,30,45,0.08); border:1px solid rgba(255,30,45,0.25); border-radius:var(--radius-sm); padding:0.75rem; margin-bottom:0.75rem;">
      <div style="font-size:0.78rem; font-weight:700; color:#FFA4A9; margin-bottom:0.25rem;">Mandatory Script Inclusions:</div>
      <ul style="padding-left:1.2rem; font-size:0.78rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.2rem;">
        ${(c.mandatory_points || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
      </ul>
    </div>
  `;
}

// Creator Script Live AI Pre-Check
function testScriptRealtimeAi() {
  const text = document.getElementById('creatorScriptInput').value;
  const campId = document.getElementById('creatorActiveCampaignSelect').value;
  const c = state.campaigns.find(camp => camp.id === campId);
  if (!text || text.trim().length === 0) {
    showToast('Please draft a script to test', 'error');
    return;
  }

  // Local instant client-side audit
  const resultBox = document.getElementById('creatorRealtimeAuditResult');
  resultBox.style.display = 'block';

  const textLower = text.toLowerCase();
  const hasHashtag = textLower.includes('boat') || textLower.includes('#dowhatfloatsyourboat');
  const hasCTA = textLower.includes('link in bio') || textLower.includes('promo code') || textLower.includes('bio') || textLower.includes('check out');
  
  // Check campaign specific mandatory points
  const mandatory = c?.mandatory_points || [];
  let matchedPoints = 0;
  const missingPoints = [];
  for (const p of mandatory) {
    const kw = p.toLowerCase().split(' ').filter(w => w.length > 3)[0] || 'boat';
    if (textLower.includes(kw)) {
      matchedPoints++;
    } else {
      missingPoints.push(p);
    }
  }

  let complianceScore = 50;
  if (hasHashtag) complianceScore += 15;
  if (hasCTA) complianceScore += 15;
  if (mandatory.length > 0) {
    complianceScore += Math.round((matchedPoints / mandatory.length) * 20);
  } else {
    complianceScore += 20;
  }

  const isApproved = complianceScore >= 80 && missingPoints.length === 0;

  resultBox.innerHTML = `
    <div style="background:var(--boat-surface); border:1px solid ${isApproved ? 'var(--neon-green)' : '#EF4444'}; border-radius:var(--radius-md); padding:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span style="font-weight:700; color:#FFF; font-size:0.88rem;">🤖 Realtime AI Script Audit:</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="status-pill ${isApproved ? 'status-selected' : 'status-rejected'}" style="font-size:0.75rem;">
            ${isApproved ? '✅ PASS (Approved)' : '❌ REJECTED (< 80 or Missing Specs)'}
          </span>
          <span style="font-weight:800; color:${isApproved ? 'var(--neon-green)' : '#EF4444'}; font-size:0.95rem;">
            ${complianceScore}/100
          </span>
        </div>
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.5;">
        ${hasHashtag ? '✓ Campaign hashtag detected' : '⚠️ Missing boAt campaign hashtag (#DoWhatFloatsYourBoAt)'}<br>
        ${hasCTA ? '✓ Call to Action (CTA) included' : '⚠️ Missing Call to Action ("link in bio" or promo callout)'}<br>
        ${missingPoints.length === 0 ? '✓ All required product specifications mentioned' : `<span style="color:#F87171;">⚠️ Missing mandatory product specs: ${missingPoints.map(p => escapeHtml(p)).join(', ')}</span>`}
      </div>
    </div>
  `;
}

async function submitCreatorScriptDraft() {
  const campId = document.getElementById('creatorActiveCampaignSelect')?.value || state.campaigns[0]?.id;
  let infId = document.getElementById('creatorActiveInfluencerSelect')?.value;

  // Robust fallback if select element didn't have value selected
  if (!infId && state.lastAcceptedInfluencerId) {
    infId = state.lastAcceptedInfluencerId;
  }
  if (!infId) {
    const acceptedOnly = state.influencers.filter(i => 
      i.status !== 'Rejected' && (i.suitability_score >= 80 || i.status === 'Selected' || i.status === 'Brief Shared' || i.status === 'Script Submitted' || i.status === 'Script Approved')
    );
    if (acceptedOnly.length > 0) {
      infId = acceptedOnly[0].id;
    }
  }

  const concept = document.getElementById('creatorConceptTitle')?.value?.trim() || 'boAt Video Showcase';
  const text = document.getElementById('creatorScriptInput')?.value?.trim();

  if (!infId) {
    showToast('Please submit or select an approved creator profile first', 'error');
    return;
  }

  if (!text || text.length === 0) {
    showToast('Please provide script text before submitting', 'error');
    return;
  }

  const submitBtn = document.querySelector('#creatorWorkspaceSection button.btn-primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Auditing & Submitting Script...';
  }

  try {
    const res = await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: campId,
        influencer_id: infId,
        concept_title: concept,
        script_text: text,
        video_format: 'Instagram Reel (9:16 vertical)'
      })
    });
    const data = await res.json();
    if (data.success) {
      const isApproved = data.isApproved;
      const score = data.auditResult?.complianceScore || 0;
      showToast(
        isApproved 
          ? `🎉 Script APPROVED by AI (${score}/100)! Live in boAt Marketing Pipeline.` 
          : `⚠️ Script Submitted (${score}/100). Changes requested by AI. Sent to Marketing Pipeline.`,
        isApproved ? 'success' : 'warning'
      );
      document.getElementById('creatorScriptInput').value = '';
      document.getElementById('creatorConceptTitle').value = '';
      const auditResultBox = document.getElementById('creatorRealtimeAuditResult');
      if (auditResultBox) auditResultBox.style.display = 'none';

      // Re-fetch all data to ensure pipeline, scripts, and stats are 100% updated in real-time
      await fetchAllData();
      if (data.scriptId) {
        loadScriptIntoStudio(data.scriptId);
      }
      
      // Automatically switch to pipeline view so user sees creator card update live
      switchView('view-pipeline');
    } else {
      showToast(data.error || 'Failed to submit script', 'error');
    }
  } catch (err) {
    console.error('Error submitting script:', err);
    showToast('Failed to submit script. Please check connection.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Submit Script to boAt Marketing Team';
    }
  }
}

// ===================================================
// Modals & User Actions
// ===================================================
function openAiEvalModal(influencerId) {
  const inf = state.influencers.find(i => i.id === influencerId);
  if (!inf) return;

  state.selectedInfluencer = inf;
  document.getElementById('modalEvalName').textContent = `${inf.name} - AI Evaluation`;
  document.getElementById('modalEvalHandle').textContent = `@${inf.instagram_handle} • ${inf.category} • ${inf.tier}`;

  const body = document.getElementById('modalEvalBody');
  const ai = inf.ai_evaluation || {};
  const params = ai.parameterScores || {};
  const genuineness = params.profileGenuineness ?? params.credibilityReach ?? (ai.botRisk ? 35 : 94);
  const vibe = params.brandVibeFit ?? params.brandCategoryFit ?? 90;
  const engagement = params.engagementQuality ?? 85;
  const youth = params.youthAesthetics ?? params.audienceRelevance ?? 82;
  const isSelected = (inf.suitability_score || 0) >= 80;

  body.innerHTML = `
    <div class="ai-report-grid">
      <div class="score-hero-box">
        <div class="score-circle">
          <span class="score-circle-num">${inf.suitability_score || 0}</span>
          <span class="score-circle-label">Fit Score</span>
        </div>
        <div class="score-hero-badge ${isSelected ? 'score-platinum' : 'score-mismatch'}">
          ${isSelected ? '✅ Selected (≥80)' : '❌ Rejected (<80)'}
        </div>
        <div class="score-hero-verdict">"${escapeHtml(ai.verdict || '')}"</div>
        <div style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-secondary);">
          Genuineness Check: <strong style="color:${ai.botRisk ? '#EF4444' : 'var(--neon-green)'};">${ai.botRisk ? '⚠️ High Bot Risk' : '✅ 98% Authentic'}</strong>
        </div>
      </div>

      <div class="ai-parameters-box">
        <div style="font-weight:700; color:#FFF; font-size:0.92rem; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
          <span>📊 AI Parameters (80+ to Pass)</span>
          <span class="status-pill ${isSelected ? 'status-selected' : 'status-rejected'}" style="font-size:0.7rem;">
            ${isSelected ? 'QUALIFIED' : 'DISQUALIFIED'}
          </span>
        </div>
        ${renderParamBar('Profile Genuineness & Bot Audit (30%)', genuineness)}
        ${renderParamBar('boAt Brand Vibe & Synergy (35%)', vibe)}
        ${renderParamBar('Audience Engagement & Retention (20%)', engagement)}
        ${renderParamBar('Youth Demographics & Aesthetics (15%)', youth)}
      </div>
    </div>

    <div style="margin-top:1.25rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
      <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:0.85rem;">
        <strong style="color:var(--neon-green); font-size:0.82rem;">Key Strengths:</strong>
        <ul style="padding-left:1.1rem; font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">
          ${(ai.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
      <div style="background:var(--boat-surface-card); border:1px solid var(--boat-border); border-radius:var(--radius-md); padding:0.85rem;">
        <strong style="color:var(--neon-amber); font-size:0.82rem;">Drawbacks / Risks:</strong>
        <ul style="padding-left:1.1rem; font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">
          ${(ai.drawbacks || []).map(d => `<li>${escapeHtml(d)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  openModal('modalAiEval');
}

function onModalStatusChange(newStatus) {
  if (!state.selectedInfluencer) return;
  advanceInfluencerStage(state.selectedInfluencer.id, newStatus);
  closeModal('modalAiEval');
}

function openOnboardModal() {
  switchView('view-creator-portal');
  const card = document.getElementById('creatorApplicationCard');
  if (card) card.scrollIntoView({ behavior: 'smooth' });
}

function openNewCampaignModal() {
  openModal('modalNewCampaign');
}

async function handleCreateCampaignSubmit(event) {
  event.preventDefault();
  const mandatoryLines = document.getElementById('newCampMandatory').value.split('\n').filter(l => l.trim().length > 0);

  const payload = {
    title: document.getElementById('newCampTitle').value,
    product_name: document.getElementById('newCampProduct').value,
    category: document.getElementById('newCampCategory').value,
    budget: document.getElementById('newCampBudget').value,
    target_audience: document.getElementById('newCampAudience').value,
    objective: document.getElementById('newCampObjective').value,
    mandatory_points: mandatoryLines
  };

  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('New boAt campaign created!', 'success');
      closeModal('modalNewCampaign');
      fetchAllData();
    }
  } catch (err) {
    showToast('Failed to create campaign', 'error');
  }
}

function openCustomMessageModal() {
  openModal('modalCustomMessage');
}

async function handleSendCustomMessage(event) {
  event.preventDefault();
  const payload = {
    influencer_id: document.getElementById('msgRecipientSelect').value,
    channel: document.getElementById('msgChannelSelect').value,
    subject: document.getElementById('msgSubjectInput').value,
    body: document.getElementById('msgBodyInput').value
  };

  try {
    const res = await fetch('/api/communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Notification sent to creator!', 'success');
      closeModal('modalCustomMessage');
      fetchCommunications();
    }
  } catch (err) {
    showToast('Failed to send notification', 'error');
  }
}

async function reseedDatabase() {
  if (!confirm('Re-seed the database with clean boAt campaign & creator data?')) return;
  try {
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Database re-seeded successfully!', 'success');
      fetchAllData();
    }
  } catch (err) {
    showToast('Error resetting database', 'error');
  }
}

function copyBriefLink() {
  navigator.clipboard.writeText(window.location.origin + '#brief');
  showToast('Brief URL copied to clipboard!', 'info');
}

function sendCampaignBriefToCreator(influencerId) {
  advanceInfluencerStage(influencerId, 'Brief Shared');
}

// ===================================================
// UI Helpers: Modals & Toasts
// ===================================================
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('active');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function getScoreBadge(score, grade) {
  score = score || 0;
  let cls = 'score-silver';
  if (score >= 90) cls = 'score-platinum';
  else if (score >= 80) cls = 'score-gold';
  else if (score < 60) cls = 'score-mismatch';

  return `<div class="ai-score-pill ${cls}">⚡ ${score}</div>`;
}

function getMatchGradeClass(grade) {
  if (!grade) return 'score-silver';
  if (grade.includes('Platinum')) return 'score-platinum';
  if (grade.includes('Gold')) return 'score-gold';
  if (grade.includes('Mismatch') || grade.includes('Risk')) return 'score-mismatch';
  return 'score-silver';
}

function getStatusClass(status) {
  const map = {
    'Applied': 'status-applied',
    'Screening': 'status-screening',
    'Shortlisted': 'status-shortlisted',
    'Contacted': 'status-contacted',
    'Negotiation': 'status-negotiation',
    'Selected': 'status-selected',
    'Brief Shared': 'status-brief-shared',
    'Script Submitted': 'status-script-submitted',
    'Script Approved': 'status-script-approved',
    'Content Created': 'status-content-created',
    'Published': 'status-published',
    'Campaign Completed': 'status-campaign-completed',
    'Rejected': 'status-rejected'
  };
  return map[status] || 'status-applied';
}

function formatNumber(num) {
  num = Number(num) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
