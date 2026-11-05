(() => {
  const authGate = document.getElementById('authGate');
  const appShell = document.getElementById('appShell');
  const authForm = document.getElementById('authForm');
  const authStatus = document.getElementById('authStatus');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSubmit = document.getElementById('authSubmit');
  const authModeToggle = document.getElementById('authModeToggle');
  const authPassword = document.getElementById('authPassword');
  const editor = document.getElementById('editor');
  const editorToggle = document.querySelector('[onclick="toggleEditor()"]');
  let supabaseClient;
  let signUpMode = false;
  let activeUserId = null;
  let currentProfile = null;
  const seedScripts = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('recruiterflow_library_v1') || 'null');
      if (Array.isArray(saved) && saved.length > 0 && saved.every((item) =>
        item && ['CD', 'OO'].includes(item.type) &&
        typeof item.title === 'string' && typeof item.text === 'string'
      )) return saved;
    } catch (error) {}
    return DATA.map(({ type, title, text }) => ({ type, title, text }));
  })();

  function setAuthMode(isSignUp) {
    signUpMode = isSignUp;
    authTitle.textContent = isSignUp ? 'Hisob yaratish' : 'Hisobga kirish';
    authSubtitle.textContent = isSignUp
      ? 'Yangi hisoblar User roli bilan ochiladi.'
      : 'RecruiterFlow hisobingiz bilan kiring.';
    authSubmit.textContent = isSignUp ? 'Hisob yaratish' : 'Kirish';
    authModeToggle.textContent = isSignUp ? 'Kirish' : 'Hisob yaratish';
    authPassword.autocomplete = isSignUp ? 'new-password' : 'current-password';
  }

  function setAuthVisible(message = '') {
    activeUserId = null;
    currentProfile = null;
    appShell.style.display = 'none';
    authGate.style.display = 'flex';
    authStatus.textContent = message;
  }

  function canEditScripts(profile = currentProfile) {
    return Boolean(profile && (
      profile.role === 'owner' || profile.role === 'admin' ||
      (profile.role === 'editor' && profile.can_edit_scripts)
    ));
  }

  function showApp(profile) {
    currentProfile = profile;
    authGate.style.display = 'none';
    appShell.style.display = 'block';
    const header = document.querySelector('.top');
    let badge = document.getElementById('ownerBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'ownerBadge';
      badge.style.cssText = 'margin-left:12px;padding:4px 9px;border-radius:7px;background:#203b60;color:#bcd7ff;font-size:11px;font-weight:800';
      header.firstElementChild.appendChild(badge);
      const logout = document.createElement('button');
      logout.className = 'btn';
      logout.textContent = 'Chiqish';
      logout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        setAuthVisible('Hisobdan chiqdingiz.');
      });
      header.appendChild(logout);
    }
    badge.textContent = profile.role.toUpperCase();
    editorToggle.style.display = canEditScripts(profile) ? '' : 'none';
    document.querySelector('#editor .small').textContent = 'Skriptlar barcha foydalanuvchilar bilan Supabase orqali ulashiladi.';
    renderBackendPanel();
  }

  function renderBackendPanel() {
    let panel = document.getElementById('backendPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'backendPanel';
      panel.className = 'intro';
      panel.innerHTML = '<h2 style="margin:0 0 10px">Foydalanuvchilar va audit</h2><div id="profileManager" class="hidden"><h3>Rollar va ruxsatlar</h3><div id="profileRows"></div></div><div><h3>Audit jurnali</h3><div id="auditRows" class="small">Yuklanmoqda...</div></div>';
      appShell.insertBefore(panel, appShell.children[1]);
    }
    const manager = document.getElementById('profileManager');
    manager.classList.toggle('hidden', currentProfile.role !== 'owner');
    if (currentProfile.role === 'owner') loadProfiles();
    loadAuditLogs();
  }

  async function loadProfiles() {
    const rows = document.getElementById('profileRows');
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id,email,display_name,role,can_edit_scripts')
      .order('email');
    if (error) {
      rows.textContent = 'Foydalanuvchilarni yuklab bo‘lmadi: ' + error.message;
      return;
    }
    rows.replaceChildren();
    data.forEach((profile) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding:10px 0';
      const label = document.createElement('span');
      label.style.cssText = 'flex:1;min-width:180px';
      label.textContent = (profile.display_name || profile.email || profile.id) + (profile.email ? ' · ' + profile.email : '');
      const role = document.createElement('select');
      role.style.cssText = 'background:#0b1728;color:white;border:1px solid var(--line);padding:8px;border-radius:7px';
      ['owner', 'admin', 'editor', 'user'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value.toUpperCase();
        role.appendChild(option);
      });
      role.value = profile.role;
      const editLabel = document.createElement('label');
      editLabel.style.cssText = 'display:flex;align-items:center;gap:5px';
      const canEdit = document.createElement('input');
      canEdit.type = 'checkbox';
      canEdit.checked = profile.can_edit_scripts;
      editLabel.append(canEdit, document.createTextNode('Editor ruxsati'));
      const save = document.createElement('button');
      save.textContent = 'Saqlash';
      const isSelf = profile.id === currentProfile.id;
      if (isSelf) {
        role.disabled = true;
        canEdit.disabled = true;
      }
      save.disabled = isSelf;
      save.addEventListener('click', async () => {
        save.disabled = true;
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ role: role.value, can_edit_scripts: canEdit.checked })
          .eq('id', profile.id);
        if (updateError) {
          authStatus.textContent = 'Ruxsatlarni saqlab bo‘lmadi: ' + updateError.message;
          save.disabled = false;
          return;
        }
        authStatus.textContent = 'Foydalanuvchi ruxsatlari saqlandi.';
        await loadProfiles();
        await loadAuditLogs();
      });
      row.append(label, role, editLabel, save);
      rows.appendChild(row);
    });
  }

  async function loadAuditLogs() {
    const rows = document.getElementById('auditRows');
    const { data, error } = await supabaseClient
      .from('audit_logs')
      .select('actor_id,action,target_type,target_id,details,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      rows.textContent = 'Audit jurnalini yuklab bo‘lmadi: ' + error.message;
      return;
    }
    if (!data.length) {
      rows.textContent = 'Hozircha audit yozuvlari yo‘q.';
      return;
    }
    rows.replaceChildren();
    data.forEach((entry) => {
      const row = document.createElement('div');
      row.style.cssText = 'border-top:1px solid var(--line);padding:8px 0;overflow-wrap:anywhere';
      const details = entry.details && entry.details.title ? ' · ' + entry.details.title : '';
      row.textContent = new Date(entry.created_at).toLocaleString() + ' · ' + entry.action + ' · ' + (entry.actor_id || 'system') + details;
      rows.appendChild(row);
    });
  }

  async function loadScripts() {
    let result = await supabaseClient
      .from('scripts')
      .select('id,category,title,body')
      .order('category')
      .order('created_at');
    if (result.error) throw result.error;
    if (result.data.length === 0 && canEditScripts()) {
      const seedRows = seedScripts.map((item) => ({
        category: item.type,
        title: item.title,
        body: item.text
      }));
      const inserted = await supabaseClient.from('scripts').insert(seedRows);
      if (inserted.error) {
        result = await supabaseClient
          .from('scripts')
          .select('id,category,title,body')
          .order('category')
          .order('created_at');
        if (result.error || result.data.length === 0) throw inserted.error;
      } else {
        result = await supabaseClient
          .from('scripts')
          .select('id,category,title,body')
          .order('category')
          .order('created_at');
        if (result.error) throw result.error;
      }
    }
    DATA = result.data.map((item) => ({
      id: item.id,
      type: item.category,
      title: item.title,
      text: item.body
    }));
    render();
    refreshEditorList();
  }

  async function openUserSession(user) {
    if (activeUserId === user.id) return;
    activeUserId = user.id;
    authStatus.textContent = 'Profil va skriptlar yuklanmoqda...';
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id,email,display_name,role,can_edit_scripts')
      .eq('id', user.id)
      .single();
    if (error) {
      activeUserId = null;
      setAuthVisible('Profilni yuklab bo‘lmadi. Sxema migratsiyasi ishga tushirilganini tekshiring.');
      return;
    }
    currentProfile = profile;
    try {
      await loadScripts();
      showApp(profile);
      authStatus.textContent = '';
      if (profile.role === 'editor' && !profile.can_edit_scripts) {
        authStatus.textContent = 'Editor roli uchun skript tahrirlash ruxsati hali berilmagan.';
      }
    } catch (error) {
      activeUserId = null;
      setAuthVisible('Skriptlarni yuklab bo‘lmadi: ' + error.message);
    }
  }

  window.toggleEditor = function(force) {
    if (!canEditScripts()) return;
    const show = typeof force === 'boolean' ? force : editor.classList.contains('hidden');
    editor.classList.toggle('hidden', !show);
    if (show) {
      refreshEditorList();
      if (editingIndex < 0) startNewSection();
    }
  };

  window.saveEditedSection = async function() {
    if (!canEditScripts()) return;
    const category = document.getElementById('editType').value;
    const title = document.getElementById('editTitle').value.trim();
    const body = document.getElementById('editText').value.trim();
    const status = document.getElementById('editorStatus');
    if (!title || !body) {
      status.textContent = 'Bo‘lim nomi va matnini kiriting.';
      return;
    }
    status.textContent = 'Saqlanmoqda...';
    const existing = editingIndex >= 0 ? DATA[editingIndex] : null;
    const result = existing?.id
      ? await supabaseClient.from('scripts').update({ category, title, body }).eq('id', existing.id)
      : await supabaseClient.from('scripts').insert({ category, title, body });
    if (result.error) {
      status.textContent = 'Saqlab bo‘lmadi: ' + result.error.message;
      return;
    }
    await loadScripts();
    current = category;
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === category));
    render();
    refreshEditorList();
    startNewSection();
    status.textContent = 'Skript Supabase’da saqlandi.';
  };

  window.deleteEditedSection = async function() {
    if (!canEditScripts() || editingIndex < 0 || !DATA[editingIndex]?.id) return;
    const item = DATA[editingIndex];
    if (!confirm('“' + item.title + '” bo‘limini o‘chirishni tasdiqlaysizmi?')) return;
    const { error } = await supabaseClient.from('scripts').delete().eq('id', item.id);
    if (error) {
      document.getElementById('editorStatus').textContent = 'O‘chirib bo‘lmadi: ' + error.message;
      return;
    }
    await loadScripts();
    refreshEditorList();
    startNewSection();
    document.getElementById('editorStatus').textContent = 'Skript o‘chirildi.';
  };

  authModeToggle.addEventListener('click', () => setAuthMode(!signUpMode));
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;
    const email = document.getElementById('authEmail').value.trim();
    const password = authPassword.value;
    authSubmit.disabled = true;
    authStatus.textContent = signUpMode ? 'Hisob yaratilmoqda...' : 'Kirilmoqda...';
    try {
      if (signUpMode) {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) await openUserSession(data.user);
        else authStatus.textContent = 'Email manzilingizga tasdiqlash havolasi yuborildi. Tasdiqlagach kiring.';
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await openUserSession(data.user);
      }
    } catch (error) {
      authStatus.textContent = error.message || 'Autentifikatsiya amalga oshmadi.';
    } finally {
      authSubmit.disabled = false;
    }
  });

  const projectUrl = window.RECRUITERFLOW_SUPABASE_URL;
  const publishableKey = window.RECRUITERFLOW_SUPABASE_PUBLISHABLE_KEY;
  if (!projectUrl || !publishableKey || !window.supabase?.createClient) {
    authStatus.textContent = 'Supabase sozlanmagan. supabase-config.js fayliga Project URL va publishable key kiriting.';
    authSubmit.disabled = true;
    authModeToggle.disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(projectUrl, publishableKey);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      if (session?.user) openUserSession(session.user);
      else if (activeUserId) setAuthVisible('Sessiya yakunlandi.');
    }, 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) authStatus.textContent = 'Sessiyani tekshirib bo‘lmadi: ' + error.message;
    else if (data.session?.user) openUserSession(data.session.user);
  });
})();