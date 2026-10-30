/*
  Term Prep Tracker — a dependency-free GitHub Pages app.
  Records are stored locally in the current browser, not in GitHub.
  Export a JSON backup to move data to another browser or device.
*/
(() => {
  'use strict';

  const KEY = 'digital-learning-term-prep-v1';
  const FIELDS = [
    { key: 'syllabus', label: 'Updated syllabus', short: 'SYLLABUS', prompt: 'Have you received the updated syllabus?' },
    { key: 'importVersion', label: 'Import version', short: 'IMPORT VERSION', prompt: 'Is the course version / import preference confirmed?' },
    { key: 'dueDates', label: 'Due dates', short: 'DUE DATES', prompt: 'Have you received or confirmed the due-date information?' },
    { key: 'liveSessions', label: 'Live sessions', short: 'LIVE SESSIONS', prompt: 'Have the live-session dates been received or marked not required?' }
  ];
  const VALUES = [
    { id: 'received', label: '✓ Received' },
    { id: 'missing', label: '— Missing' },
    { id: 'na', label: 'N/A' },
    { id: 'clarify', label: '? Clarify' }
  ];
  const STATUS_DATA = {
    complete: { label: 'Complete', color: '#26846b', soft: '#e9f7f0', symbol: '✓' },
    partial: { label: 'Partial', color: '#b97b23', soft: '#fff5df', symbol: '◐' },
    none: { label: 'None', color: '#c93848', soft: '#fff0f1', symbol: '—' },
    verify: { label: 'To verify', color: '#697b8a', soft: '#f0f3f7', symbol: '?' },
    unreviewed: { label: 'Not checked', color: '#9aa4ae', soft: '#f3f5f6', symbol: '·' }
  };
  const seedRows = [
    ['BUAD 503','Business Communication','Angel Norman'],
    ['ACCT 503','Financial and Managerial Accounting','Winston Smith'],
    ['STAT 503','Quantitative Methods','Allen Pannell & Yuanyang Liu'],
    ['BZAN 503','Operations Management and Decision Modeling','Bogdan Bichescu & Paolo Letizia'],
    ['SCM 503','Supply Chain Management Strategy, Operations, and Customer Value','Alan Amling'],
    ['FINC 503','Financial Management','Eric Kelley'],
    ['FINC 504','Financial Statement Analysis','Tracie Woidtke'],
    ['MGT 503','Strategic Decision Making','Dave Williams'],
    ['MARK 503','Marketing Strategy','Zach Thompson'],
    ['ECON 503','Economics in a Global Environment','Scott Gilpatric & Robert Cobb'],
    ['BZAN 504','Supply Chain Models','Sean Willems'],
    ['BUAD 583','AI Fluency and Strategy for Managers','David Maslar'],
    ['MARK 538','','Alex Zablah (Course Champion) & Aaron Garvey'],
    ['MGT 595','','Kurt Jacobs'],
    ['MGT 596','','Jason Strickling']
  ];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const courseFromRow = ([code,title,instructor],i) => ({id:`course-${i+1}`,code,title,instructor,canvas:'',fields:{syllabus:'unreviewed',importVersion:'unreviewed',dueDates:'unreviewed',liveSessions:'unreviewed'},notes:''});
  const freshTerm = () => ({ id:'spring-2027-omba',name:'Spring 2027 OMBA',semester:'Spring 2027',program:'OMBA',courses:seedRows.map(courseFromRow),createdAt:'2026-10-30T12:00:00',updatedAt:'2026-10-30T12:00:00',hasCompletedCheckin:false, baselineDismissed:false,baseline:{complete:1,partial:6,none:8,verify:0,unreviewed:0},history:[] });
  const defaultStore = () => ({schemaVersion:1,activeTermId:'spring-2027-omba',terms:[freshTerm()]});
  const validField = value => ['received','missing','na','clarify','unreviewed'].includes(value) ? value : 'unreviewed';
  const clamp = (value,max) => String(value ?? '').slice(0,max);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  let store = loadStore();
  let activeView = 'dashboard';
  let wizard = null;
  let editorCourseId = null;
  let toastTimeout = null;

  function normalizeCourse(c,i) {
    if (!c || typeof c !== 'object') return null;
    return {id:clamp(c.id || uid(),90),code:clamp(c.code || `Course ${i+1}`,80),title:clamp(c.title,200),instructor:clamp(c.instructor,200),canvas:clamp(c.canvas,500),fields:Object.fromEntries(FIELDS.map(f=>[f.key,validField(c.fields?.[f.key])])),notes:clamp(c.notes,5000)};
  }
  function normalizeTerm(t,i) {
    if (!t || typeof t !== 'object' || !Array.isArray(t.courses)) return null;
    const courses=t.courses.slice(0,200).map(normalizeCourse).filter(Boolean);
    const hist=Array.isArray(t.history) ? t.history.slice(-100).filter(h=>h&&typeof h==='object').map(h=>({id:clamp(h.id||uid(),90),at:clamp(h.at,50),total:Number(h.total)||0,counts:Object.fromEntries(Object.keys(STATUS_DATA).map(k=>[k,Math.max(0,Number(h.counts?.[k])||0)]))})) : [];
    return {id:clamp(t.id||uid(),90),name:clamp(t.name||`Term ${i+1}`,100),semester:clamp(t.semester||t.name,80),program:clamp(t.program,80),courses,createdAt:clamp(t.createdAt,50)||new Date().toISOString(),updatedAt:clamp(t.updatedAt,50)||new Date().toISOString(),hasCompletedCheckin:Boolean(t.hasCompletedCheckin),baselineDismissed:Boolean(t.baselineDismissed),baseline:t.baseline&&typeof t.baseline==='object' ? Object.fromEntries(Object.keys(STATUS_DATA).map(k=>[k,Math.max(0,Number(t.baseline[k])||0)])) : null,history:hist};
  }
  // Repair the original 15-course Spring 2027 starter roster without replacing
  // existing course submissions, saved notes, check-in history, or user edits.
  function reconcileSpring2027Roster(terms) {
    const t = terms.find(term => term.id === 'spring-2027-omba');
    if (!t) return false;
    let changed = false;
    seedRows.forEach(([code,title,instructor],i) => {
      const c = t.courses.find(course => course.id === `course-${i+1}`);
      if (!c) return;
      // The first release included two placeholder rows for MGT 595 and MGT 596.
      if (i >= 13 && c.code === `Course ${i+1}`) {
        if (t.courses.some(other => other !== c && other.code === code)) return;
        c.code = code;
        c.title = title;
        c.instructor = instructor;
        changed = true;
        return;
      }
      if (c.code !== code) return; // Don't overwrite a repurposed course.
      if (!c.title && title) { c.title = title; changed = true; }
      // Only amend blank/previously seeded MARK 538 faculty names; preserve custom edits.
      if (i === 12) {
        const old = c.instructor.trim();
        if (!old || /^Alex Zablah(?: \(Course Champion\))?(?: & Aaron Garvey)?$/.test(old)) {
          if (c.instructor !== instructor) { c.instructor = instructor; changed = true; }
        }
      } else if (!c.instructor && instructor) {
        c.instructor = instructor;
        changed = true;
      }
    });
    return changed;
  }
  function loadStore() {
    try {
      const saved=localStorage.getItem(KEY);
      if (!saved) return defaultStore();
      const raw=JSON.parse(saved);
      if(!raw || !Array.isArray(raw.terms)) return defaultStore();
      const terms=raw.terms.slice(0,50).map(normalizeTerm).filter(Boolean);
      if(!terms.length) return defaultStore();
      const next={schemaVersion:1,terms,activeTermId:terms.some(t=>t.id===raw.activeTermId)?raw.activeTermId:terms[0].id};
      if (reconcileSpring2027Roster(terms)) {
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { /* leave loaded data intact */ }
      }
      return next;
    } catch(e) { return defaultStore(); }
  }
  function persist() {
    try { localStorage.setItem(KEY,JSON.stringify(store)); $('#save-indicator').title='Saved in browser storage'; }
    catch(e) { toast('Browser storage is unavailable. Export a JSON backup to preserve your updates.'); }
  }
  const currentTerm = () => store.terms.find(t=>t.id===store.activeTermId) || store.terms[0];
  const dateLabel = iso => { const d=new Date(iso); return Number.isNaN(d.getTime())?'Not available':new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(d); };
  const timestampLabel = iso => {const d=new Date(iso);return Number.isNaN(d.getTime())?'Unknown date':new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(d);};
  function statusFor(course) {
    const vals=FIELDS.map(f=>validField(course.fields?.[f.key]));
    if(vals.every(v=>v==='unreviewed')) return 'unreviewed';
    if(vals.some(v=>v==='unreviewed'||v==='clarify')) return 'verify';
    const received=vals.filter(v=>v==='received').length;
    const missing=vals.filter(v=>v==='missing').length;
    if(!missing) return 'complete';
    return received ? 'partial' : 'none';
  }
  function countsFrom(courses) {
    const result={complete:0,partial:0,none:0,verify:0,unreviewed:0};
    courses.forEach(c=>result[statusFor(c)]++);
    return result;
  }
  function overviewCounts(t) { return !t.hasCompletedCheckin && t.baseline ? t.baseline : countsFrom(t.courses); }
  function statusBadge(status) { return `<span class="status-badge badge-${status}"><span class="badge-dot"></span>${escapeHTML(STATUS_DATA[status].label)}</span>`; }
  function fieldIcon(value) { const v=validField(value); const display={received:'✓',missing:'—',na:'N/A',clarify:'?',unreviewed:'·'}[v];return `<span class="status-icon icon-${v}" title="${escapeHTML({received:'Received',missing:'Missing',na:'Not required',clarify:'Needs clarification',unreviewed:'Not checked'}[v])}">${display}</span>`; }
  function toast(message) { const el=$('#toast');clearTimeout(toastTimeout);el.textContent=message;el.classList.remove('hidden');toastTimeout=setTimeout(()=>el.classList.add('hidden'),3400); }
  function renderTermSelector() {const t=currentTerm();$('#term-select').innerHTML=store.terms.map(x=>`<option value="${escapeHTML(x.id)}" ${x.id===t.id?'selected':''}>${escapeHTML(x.name)}</option>`).join('');}
  function updateNav() { $$('.side-link').forEach(el=>el.classList.toggle('active',el.dataset.view===activeView));$('#nav-course-count').textContent=currentTerm().courses.length;$('#breadcrumb-name').textContent=({dashboard:'Dashboard',courses:'All Courses',history:'Check-in History'})[activeView];}
  function showView(view) { activeView=view;['dashboard','courses','history'].forEach(k=>$(`#${k}-view`).classList.toggle('hidden',k!==view));updateNav();render();$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'instant'}); }
  function render(){ const t=currentTerm();renderTermSelector();updateNav();if(activeView==='dashboard')renderDashboard(t);if(activeView==='courses')renderDirectory(t);if(activeView==='history')renderHistory(t); }

  function renderDashboard(t) {
    const counts=overviewCounts(t), total=t.courses.length;
    const historical=!t.hasCompletedCheckin && Boolean(t.baseline);
    $('#page-title').innerHTML=`${escapeHTML(t.semester)} <em>${escapeHTML(t.program)}</em>`;
    $('#last-updated').textContent=`Last updated: ${dateLabel(t.updatedAt)}`;
    $('#course-total').textContent=`${total} ${total===1?'course':'courses'}`;
    $('#term-chip-title').textContent=t.semester;
    $('#overview-date').textContent=historical?'PREVIOUS REPORTED OVERVIEW':`AS OF ${dateLabel(t.updatedAt).toUpperCase()}`;
    $('#progress-subheading').textContent=historical?'Your previous overall summary, pending your first course check-in.':'A quick look at how your courses are moving along.';
    $('#baseline-banner').classList.toggle('hidden',!historical||t.baselineDismissed);
    const stats=[
      {status:'complete',label:'All materials received',kicker:'COMPLETE SUBMISSIONS'},
      {status:'partial',label:'Partial submissions',kicker:'IN PROGRESS'},
      {status:'none',label:'No required materials received',kicker:'NONE RECEIVED'},
      {status:'verify',label:'Needs review or clarification',kicker:'TO VERIFY'}
    ];
    let cards=stats.map(s=>{const info=STATUS_DATA[s.status];const value=s.status==='verify'?(counts.verify||0)+(counts.unreviewed||0):(counts[s.status]||0);return `<div class="stat-card" style="--stat-color:${info.color};--stat-bg:${info.soft}"><div class="stat-upper"><span class="stat-kicker">${s.kicker}</span><span class="stat-symbol" aria-hidden="true">${info.symbol}</span></div><div class="stat-number">${value}</div><div class="stat-title">${s.label}</div></div>`;});
    $('#stats-grid').innerHTML=cards.join('');
    $('#chart-subtitle').textContent=`${total} total ${total===1?'course':'courses'}${historical?' · previous snapshot':''}`;
    $('#chart-fraction').textContent=`${counts.complete||0} of ${total} complete`;
    const seq=['complete','partial','none','verify','unreviewed'];
    const sum=seq.reduce((acc,s)=>acc+(counts[s]||0),0);
    $('#progress-bar').innerHTML=seq.filter(s=>(counts[s]||0)>0).map(s=>`<div class="progress-section" style="width:${sum?((counts[s]||0)/sum*100):0}%;background:${STATUS_DATA[s].color}" title="${STATUS_DATA[s].label}: ${counts[s]}"></div>`).join('');
    $('#progress-bar').setAttribute('aria-label',seq.map(s=>`${STATUS_DATA[s].label}: ${counts[s]||0}`).join(', '));
    $('#chart-legend').innerHTML=seq.filter(s=>(counts[s]||0)>0 || s!=='unreviewed'&&s!=='verify').map(s=>`<div class="legend-item"><span class="legend-dot" style="background:${STATUS_DATA[s].color}"></span>${STATUS_DATA[s].label} <span class="legend-count">(${counts[s]||0})</span></div>`).join('');
    const q=$('#course-search').value.toLowerCase().trim(), filter=$('#filter-status').value;
    const courses=t.courses.filter(c=>(filter==='all'||statusFor(c)===filter)&&`${c.code} ${c.title} ${c.instructor}`.toLowerCase().includes(q));
    $('#course-tbody').innerHTML=courses.length ? courses.map(c=>`<tr data-course-id="${escapeHTML(c.id)}" title="Open check-in for ${escapeHTML(c.code)}"><td><div class="course-code">${escapeHTML(c.code)}</div>${c.title?`<div class="course-title">${escapeHTML(c.title)}</div>`:''}<div class="course-instructor">${escapeHTML(c.instructor||'Instructor to confirm')}</div></td>${FIELDS.map(f=>`<td>${fieldIcon(c.fields[f.key])}</td>`).join('')}<td>${statusBadge(statusFor(c))}</td><td class="row-arrow">›</td></tr>`).join('') : `<tr><td colspan="7" class="empty-state">No courses match this filter.</td></tr>`;
    $('#table-count').textContent=`Showing ${courses.length} of ${t.courses.length} courses`;
  }
  function renderDirectory(t){ const q=$('#directory-search').value.toLowerCase().trim();const courses=t.courses.filter(c=>`${c.code} ${c.title} ${c.instructor}`.toLowerCase().includes(q));$('#directory-grid').innerHTML=courses.length ? courses.map(c=>`<button type="button" class="directory-card" data-edit-id="${escapeHTML(c.id)}"><div class="eyebrow" style="margin-bottom:0"><span class="eyebrow-line"></span> COURSE FILE</div><h3>${escapeHTML(c.code)}</h3><p>${escapeHTML(c.title||'Course title to confirm')}</p><p style="margin-top:5px">${escapeHTML(c.instructor||'Instructor to confirm')}</p>${statusBadge(statusFor(c))}</button>`).join(''):`<div class="empty-state">No matching courses.</div>`; }
  function renderHistory(t){ const history=t.history.slice().reverse();$('#history-list').innerHTML=history.length?history.map((h,i)=>`<div class="history-item"><div><strong>${i===0?'Latest check-in':'Check-in'} · ${escapeHTML(dateLabel(h.at))}</strong><small>${escapeHTML(timestampLabel(h.at))} · ${h.total} courses</small></div><div class="history-totals"><span class="history-total">Complete <strong>${h.counts.complete||0}</strong></span><span class="history-total">Partial <strong>${h.counts.partial||0}</strong></span><span class="history-total">None <strong>${h.counts.none||0}</strong></span><span class="history-total">Verify <strong>${(h.counts.verify||0)+(h.counts.unreviewed||0)}</strong></span></div></div>`).join(''):`<div class="card empty-state">No check-ins recorded yet. Select <strong>Start Check-in</strong> to create the first one.<br><br>The October 30 baseline summary is not a course-by-course check-in.</div>`; }

  function startCheckin(courseId) {
    const t=currentTerm();if(!t.courses.length){toast('Add a course before starting a check-in.');return;}
    const index=courseId?t.courses.findIndex(c=>c.id===courseId):0;
    wizard={termId:t.id,courses:clone(t.courses),index:Math.max(0,index)};
    $('#wizard-backdrop').classList.remove('hidden');document.body.style.overflow='hidden';renderWizard();
  }
  function closeWizard() {if(wizard&&!confirm('Exit this check-in? Unsaved check-in answers will be discarded.'))return;wizard=null;$('#wizard-backdrop').classList.add('hidden');document.body.style.overflow='';}
  function renderWizard(){if(!wizard)return;const length=wizard.courses.length,idx=wizard.index,summary=idx===length;const pct=summary?100:Math.round((idx+1)/length*100);$('#wizard-counter').textContent=summary?'Review & finish':`Course ${idx+1} of ${length}`;$('#wizard-subcounter').textContent=summary?'Confirm your results before updating the dashboard':'Review each requirement for this course';$('#wizard-percent').textContent=`${pct}%`;$('#wizard-progress-fill').style.width=`${pct}%`;$('#wizard-back').disabled=idx===0;$('#wizard-next').textContent=summary?'Finish Check-in & Update Dashboard':idx===length-1?'Review Check-in →':'Next Course →';$('#wizard-title').textContent=summary?'Check-in Summary':'Course Check-in';$('#wizard-footer-hint').textContent='Changes save when you finish the check-in.';
    if(summary){const cnt=countsFrom(wizard.courses);const reviewCount=cnt.verify+cnt.unreviewed;$('#wizard-body').innerHTML=`<div class="review-summary"><div class="course-prefix" style="font-size:10px;letter-spacing:1.2px;color:var(--accent);font-weight:800;margin-bottom:12px">CHECK-IN COMPLETE</div><h3>Ready to refresh your dashboard?</h3><p>Here is the new overview based on your responses. Select Finish Check-in to save everything and regenerate the course tracker.</p><div class="review-totals">${[['Complete',cnt.complete,'var(--green)'],['Partial',cnt.partial,'var(--amber)'],['None',cnt.none,'var(--red)'],['To verify',reviewCount,'var(--blue)']].map(([label,count,color])=>`<div class="review-tile"><strong style="color:${color}">${count}</strong><span>${label}</span></div>`).join('')}</div>${reviewCount?`<div class="review-warning"><strong>${reviewCount} course(s) need follow-up.</strong> A course is marked “To verify” when a requirement is unanswered or needs clarification. You can still finish the check-in.</div>`:''}<div class="review-list">${wizard.courses.map((c,i)=>`<div class="review-item"><span>${i+1}. <strong>${escapeHTML(c.code)}</strong></span>${statusBadge(statusFor(c))}</div>`).join('')}</div></div>`;return;}
    const c=wizard.courses[idx];$('#wizard-body').innerHTML=`<div class="course-heading"><div class="course-prefix">${escapeHTML(c.code)}</div><h3>${escapeHTML(c.title||'Course details to confirm')}</h3><p>${escapeHTML(c.instructor||'Instructor not yet confirmed')}</p></div><div class="field-grid">${FIELDS.map(f=>`<section class="field-card"><h4>${escapeHTML(f.label)}</h4><p>${escapeHTML(f.prompt)}</p><div class="field-options">${VALUES.map(v=>`<button type="button" class="field-option ${c.fields[f.key]===v.id?'selected':''}" data-field="${f.key}" data-answer="${v.id}" aria-pressed="${c.fields[f.key]===v.id}">${escapeHTML(v.label)}</button>`).join('')}</div></section>`).join('')}</div><div class="notes-area"><label for="checkin-notes">Instructor preferences / ID notes</label><textarea id="checkin-notes" maxlength="5000" placeholder="Example: Requested Summer 2026 parent course; need to confirm live session dates…">${escapeHTML(c.notes)}</textarea></div>`;
  }
  function nextWizard() {if(!wizard)return;if(wizard.index<wizard.courses.length){wizard.index++;renderWizard();return;}const t=currentTerm();if(t.id!==wizard.termId){toast('Selected term changed. Check-in not saved.');return;}const now=new Date().toISOString();t.courses=wizard.courses;t.updatedAt=now;t.hasCompletedCheckin=true;t.baseline=null;const counts=countsFrom(t.courses);t.history.push({id:uid(),at:now,total:t.courses.length,counts});t.history=t.history.slice(-100);persist();wizard=null;$('#wizard-backdrop').classList.add('hidden');document.body.style.overflow='';$('#course-search').value='';$('#filter-status').value='all';showView('dashboard');toast('Check-in saved. Dashboard updated.');}

  function openEditor(id){const t=currentTerm();const c=t.courses.find(x=>x.id===id);editorCourseId=id||null;$('#editor-title').textContent=c?'Edit Course':'Add Course';const f=$('#editor-form');f.elements.code.value=c?.code||'';f.elements.title.value=c?.title||'';f.elements.instructor.value=c?.instructor||'';f.elements.canvas.value=c?.canvas||'';$('#delete-course').classList.toggle('hidden',!c);$('#editor-backdrop').classList.remove('hidden');document.body.style.overflow='hidden';f.elements.code.focus();}
  function closeEditor(){editorCourseId=null;$('#editor-backdrop').classList.add('hidden');document.body.style.overflow='';}
  function saveEditor(e){e.preventDefault();const f=e.currentTarget,code=f.elements.code.value.trim(),title=f.elements.title.value.trim(),instructor=f.elements.instructor.value.trim(),canvas=f.elements.canvas.value.trim();if(!code){toast('Course subject and number are required.');return;}if(canvas&&!/^https:\/\//i.test(canvas)){toast('Canvas URL must begin with https://');return;}const t=currentTerm();if(editorCourseId){const c=t.courses.find(x=>x.id===editorCourseId);if(c){Object.assign(c,{code,title,instructor,canvas});}}else{t.courses.push({id:uid(),code,title,instructor,canvas,fields:Object.fromEntries(FIELDS.map(f=>[f.key,'unreviewed'])),notes:''});}t.updatedAt=new Date().toISOString();persist();closeEditor();render();toast('Course saved.');}
  function deleteCourse(){if(!editorCourseId)return;const t=currentTerm();const c=t.courses.find(x=>x.id===editorCourseId);if(!c)return;if(!confirm(`Delete ${c.code} from ${t.name}? This also removes its submissions and notes.`))return;t.courses=t.courses.filter(x=>x.id!==editorCourseId);t.updatedAt=new Date().toISOString();if(t.baseline){t.baseline=null;t.hasCompletedCheckin=true;}persist();closeEditor();render();toast('Course deleted.');}
  function addTerm(){const name=prompt('Name the new term (for example, Fall 2027 OMBA):');if(name===null)return;const cleaned=name.trim();if(!cleaned||cleaned.length>100){toast('Enter a term name under 100 characters.');return;}const copy=confirm('Copy the current term’s course list into the new term? All submission answers and notes will be reset.');const prev=currentTerm();const t={id:uid(),name:cleaned,semester:cleaned.replace(/\s+OMBA$/i,'').trim(),program:/\bOMBA\b/i.test(cleaned)?'OMBA':'',courses:copy?prev.courses.map(c=>({...clone(c),id:uid(),fields:Object.fromEntries(FIELDS.map(f=>[f.key,'unreviewed'])),notes:''})):[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),hasCompletedCheckin:true,baseline:null,baselineDismissed:true,history:[]};store.terms.push(t);store.activeTermId=t.id;persist();showView('dashboard');toast('New term created.');}
  function download(name,content,mime){const blob=new Blob([content],{type:mime}),link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const filenamePart=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function exportJSON(){download('term-prep-backup.json',JSON.stringify(store,null,2)+'\n','application/json');toast('Backup exported.');}
  const csvCell=s=>`"${String(s??'').replace(/"/g,'""')}"`;
  function exportCSV(){const t=currentTerm();const columns=['Term','Course','Title','Instructor','Syllabus','Import version','Due dates','Live sessions','Overall status','Canvas link','Notes'];const lines=[columns.map(csvCell).join(',')];t.courses.forEach(c=>lines.push([t.name,c.code,c.title,c.instructor,...FIELDS.map(f=>c.fields[f.key]),STATUS_DATA[statusFor(c)].label,c.canvas,c.notes].map(csvCell).join(',')));download(`${filenamePart(t.name)}-status.csv`,'\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');toast('CSV exported.');}
  async function importJSON(file){if(!file)return;if(file.size>3*1024*1024){toast('Backup exceeds the 3 MB size limit.');return;}try{const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.terms)||raw.terms.length<1){throw new Error('Invalid backup');}const terms=raw.terms.slice(0,50).map(normalizeTerm).filter(Boolean);if(!terms.length)throw new Error('No valid terms');reconcileSpring2027Roster(terms);if(!confirm(`Import ${terms.length} term(s)? This will replace the data saved in this browser. Export a backup first if needed.`))return;store={schemaVersion:1,activeTermId:terms.some(t=>t.id===raw.activeTermId)?raw.activeTermId:terms[0].id,terms};persist();$('#course-search').value='';$('#directory-search').value='';$('#filter-status').value='all';showView('dashboard');toast('Backup imported successfully.');}catch(e){toast('This file is not a valid Term Prep backup.');}finally{$('#import-file').value='';}}

  // Event wiring
  $$('.side-link').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));
  $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#term-select').addEventListener('change',e=>{store.activeTermId=e.target.value;persist();render();});
  $('#new-term').addEventListener('click',addTerm);
  $('#start-checkin').addEventListener('click',()=>startCheckin());
  $('#course-search').addEventListener('input',()=>renderDashboard(currentTerm()));
  $('#filter-status').addEventListener('change',()=>renderDashboard(currentTerm()));
  $('#directory-search').addEventListener('input',()=>renderDirectory(currentTerm()));
  $('#add-course').addEventListener('click',()=>openEditor(null));
  $('#add-course-directory').addEventListener('click',()=>openEditor(null));
  $('#course-tbody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-course-id]');if(tr)startCheckin(tr.dataset.courseId);});
  $('#directory-grid').addEventListener('click',e=>{const card=e.target.closest('[data-edit-id]');if(card)openEditor(card.dataset.editId);});
  $('#dismiss-baseline').addEventListener('click',()=>{currentTerm().baselineDismissed=true;persist();render();});
  $('#wizard-close').addEventListener('click',closeWizard);
  $('#wizard-back').addEventListener('click',()=>{if(wizard&&wizard.index>0){wizard.index--;renderWizard();}});
  $('#wizard-next').addEventListener('click',nextWizard);
  $('#wizard-body').addEventListener('click',e=>{const option=e.target.closest('[data-field][data-answer]');if(!option||!wizard||wizard.index>=wizard.courses.length)return;wizard.courses[wizard.index].fields[option.dataset.field]=option.dataset.answer;renderWizard();});
  $('#wizard-body').addEventListener('input',e=>{if(e.target.id==='checkin-notes'&&wizard&&wizard.index<wizard.courses.length)wizard.courses[wizard.index].notes=e.target.value;});
  $('#editor-close').addEventListener('click',closeEditor);
  $('#cancel-editor').addEventListener('click',closeEditor);
  $('#editor-form').addEventListener('submit',saveEditor);
  $('#delete-course').addEventListener('click',deleteCourse);
  $('#tools-button').addEventListener('click',()=>{const el=$('#tools-menu');el.classList.toggle('hidden');$('#tools-button').setAttribute('aria-expanded',String(!el.classList.contains('hidden')));});
  document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap')){$('#tools-menu').classList.add('hidden');$('#tools-button').setAttribute('aria-expanded','false');}});
  $('#export-json').addEventListener('click',exportJSON);
  $('#export-csv').addEventListener('click',exportCSV);
  $('#import-json').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',e=>importJSON(e.target.files[0]));
  $('#print-report').addEventListener('click',()=>{showView('dashboard');window.print();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#editor-backdrop').classList.contains('hidden'))closeEditor();else if(e.key==='Escape'&&!$('#tools-menu').classList.contains('hidden'))$('#tools-menu').classList.add('hidden');else if(e.key==='Escape'&&$('#sidebar').classList.contains('open'))$('#sidebar').classList.remove('open');});

  render();
})();