/* Shared script for all pages - MongoDB Atlas version */
class FinancialManager {
  constructor() {
    this.API_URL = 'http://localhost:3000/api/transactions'; // Ganti dengan URL API backend Anda
    this.transactions = [];
    this.currentBalance = 0;
    this.pieChart = null;
    this.lineChart = null;
    this.isDarkMode = localStorage.getItem('darkMode') !== 'false';
    this.editMode = null; // Property untuk menyimpan data transaksi yang diedit
    this.init();
  }

  init() {
    this.bindCommon();
    this.initDarkMode();
    this.bindPageSpecific();
    this.fetchTransactions(); // Fetch data dari API saat aplikasi dimuat
  }

  // Metode untuk mengambil data dari API backend
  async fetchTransactions() {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) throw new Error('Gagal mengambil data dari server.');
      this.transactions = await response.json();
      this.calculateBalance();
      this.renderAll();
    } catch (error) {
      console.error('Fetch error:', error);
      this.notify('Gagal memuat data dari server.', 'error');
    }
  }

  // Mengganti fungsi `handleSubmit` untuk mengirim data ke MongoDB
  async handleSubmit(type) {
    const amountEl = document.getElementById(type === 'income' ? 'incomeAmount' : 'expenseAmount');
    const descEl = document.getElementById(type === 'income' ? 'incomeDescription' : 'expenseDescription');
    const amount = parseFloat(amountEl.value) || 0;
    const desc = descEl.value || '(no desc)';

    if (amount <= 0) {
      this.notify('Jumlah harus lebih dari 0', 'error');
      return;
    }

    if (this.editMode) {
      // Logic untuk UPDATE (PUT)
      try {
        const response = await fetch(`${this.API_URL}/${this.editMode._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, description: desc }),
        });
        if (!response.ok) throw new Error('Gagal mengubah transaksi.');
        this.notify('Transaksi berhasil diubah', 'success');
      } catch (error) {
        this.notify('Gagal mengubah transaksi.', 'error');
        console.error("API update failed: ", error);
      }
      this.cancelEdit(); // Kembali ke mode normal
    } else {
      // Logic untuk TAMBAH (POST)
      const item = {
        date: new Date().toLocaleDateString('id-ID'),
        dateISO: new Date().toISOString().split('T')[0],
        type,
        amount,
        description: desc,
      };
      try {
        const response = await fetch(this.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (!response.ok) throw new Error('Gagal menyimpan transaksi.');
        this.notify('Transaksi disimpan', 'success');
      } catch (error) {
        this.notify('Gagal menyimpan transaksi.', 'error');
        console.error("API write failed: ", error);
      }
    }
    
    amountEl.value = '';
    descEl.value = '';
    this.fetchTransactions(); // Refresh data setelah simpan/ubah
  }

  // Mengganti fungsi `clearHistory` untuk menghapus data di MongoDB
  async clearHistory() {
    if (!confirm('Hapus semua riwayat?')) return;
    try {
      const response = await fetch(this.API_URL, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Gagal menghapus riwayat.');
      this.notify('Riwayat dihapus', 'info');
      this.fetchTransactions(); // Refresh data
    } catch (error) {
      this.notify('Gagal menghapus riwayat.', 'error');
      console.error("API call failed: ", error);
    }
  }

  // Mengganti fungsi `renderManage` untuk menghapus item dari MongoDB
  renderManage() {
    const tbody = document.getElementById('manageBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    this.transactions.slice().reverse().forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2 text-sm">${t.date}</td>
        <td class="px-3 py-2 text-sm">${t.description}</td>
        <td class="px-3 py-2 text-sm text-right">${this.formatCurrency(t.amount)}</td>
        <td class="px-3 py-2 text-center">
          <button class="btn-edit bg-sky-500 text-white px-3 py-1 rounded" data-id="${t._id}">Edit</button>
          <button class="btn-delete bg-rose-500 text-white px-3 py-1 rounded ml-2" data-id="${t._id}">Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Menghapus data dari API
    tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', async e => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Hapus transaksi ini?')) return;
      try {
        const response = await fetch(`${this.API_URL}/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Gagal menghapus transaksi.');
        this.notify('Transaksi dihapus', 'info');
        this.fetchTransactions(); // Refresh data setelah hapus
      } catch (error) {
        this.notify('Gagal menghapus transaksi.', 'error');
        console.error("API call failed: ", error);
      }
    }));
    
    // Mengedit data
    tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      this.handleEdit(id);
    }));
  }

  // --- Fungsi yang tidak perlu diubah ---
  bindCommon() {
    const topToggle = document.querySelectorAll('#darkModeToggleTop');
    topToggle.forEach(btn=>btn&&btn.addEventListener('click', ()=>this.toggleDarkMode()));
    const exportBtn = document.getElementById('exportAllBtn');
    if(exportBtn) exportBtn.addEventListener('click', ()=>this.exportAll());
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            const mobileMenu = document.getElementById('mobileMenu');
            mobileMenu.classList.toggle('hidden');
        });
    }
  }

  bindPageSpecific() {
    if(document.getElementById('pieChart') || document.getElementById('lineChart')){
      this.updateCharts();
    }
    const filterBtn = document.getElementById('filterBtn');
    if(filterBtn) filterBtn.addEventListener('click', ()=> this.applyDateFilter());
    const resetBtn = document.getElementById('resetFilterBtn');
    if(resetBtn) resetBtn.addEventListener('click', ()=> this.resetFilter());
    const exportRangeBtn = document.getElementById('exportRangeBtn');
    if(exportRangeBtn) exportRangeBtn.addEventListener('click', ()=> this.exportRange());
    const clearBtn = document.getElementById('clearHistoryBtn');
    if(clearBtn) clearBtn.addEventListener('click', ()=> this.clearHistory());
    const incomeForm = document.getElementById('incomeForm');
    if(incomeForm) incomeForm.addEventListener('submit', e=>{ e.preventDefault(); this.handleSubmit('income'); });
    const expenseForm = document.getElementById('expenseForm');
    if(expenseForm) expenseForm.addEventListener('submit', e=>{ e.preventDefault(); this.handleSubmit('expense'); });
    this.renderManage();
  }
  
  // Fungsi edit yang sudah ada, hanya perlu disesuaikan dengan `_id`
  handleEdit(id){
    const t = this.transactions.find(t => t._id === id);
    if (!t) return;
    this.editMode = t;
    
    const incomeForm = document.getElementById('incomeForm');
    const expenseForm = document.getElementById('expenseForm');

    if (t.type === 'income') {
      document.getElementById('incomeAmount').value = t.amount;
      document.getElementById('incomeDescription').value = t.description;
      this.renderForm('income', true);
      expenseForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
    } else {
      document.getElementById('expenseAmount').value = t.amount;
      document.getElementById('expenseDescription').value = t.description;
      this.renderForm('expense', true);
      incomeForm.querySelectorAll('input, button').forEach(el => el.disabled = true);
    }
    
    this.notify(`Anda sedang mengedit transaksi ${t.description}`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  renderForm(type, isEditing = false) {
    const formTitle = document.getElementById(type === 'income' ? 'incomeFormTitle' : 'expenseFormTitle');
    const formBtn = document.getElementById(type === 'income' ? 'incomeFormBtn' : 'expenseFormBtn');
    
    if (isEditing) {
      formTitle.textContent = 'Edit Transaksi';
      formBtn.textContent = 'Simpan Perubahan';
      formBtn.classList.remove('bg-emerald-500', 'bg-rose-500');
      formBtn.classList.add('bg-indigo-600');
      
      const form = formBtn.parentElement;
      if (!form.querySelector('#cancelBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelBtn';
        cancelBtn.textContent = 'Batal';
        cancelBtn.type = 'button';
        cancelBtn.classList.add('btn', 'btn-secondary', 'ml-2');
        cancelBtn.addEventListener('click', () => this.cancelEdit());
        form.appendChild(cancelBtn);
      }
    } else {
      formTitle.textContent = type === 'income' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran';
      formBtn.textContent = type === 'income' ? 'Simpan Pemasukan' : 'Simpan Pengeluaran';
      formBtn.classList.remove('bg-indigo-600');
      formBtn.classList.add(type === 'income' ? 'bg-emerald-500' : 'bg-rose-500');
      
      const cancelBtn = formBtn.parentElement.querySelector('#cancelBtn');
      if (cancelBtn) {
        cancelBtn.remove();
      }
    }
  }
  
  cancelEdit(){
    this.editMode = null;
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDescription').value = '';
    
    const incomeForm = document.getElementById('incomeForm');
    const expenseForm = document.getElementById('expenseForm');
    incomeForm.querySelectorAll('input, button').forEach(el => el.disabled = false);
    expenseForm.querySelectorAll('input, button').forEach(el => el.disabled = false);

    this.renderForm('income', false);
    this.renderForm('expense', false);
    this.notify('Pengeditan dibatalkan', 'info');
  }

  calculateBalance(){
    let bal=0;
    this.transactions.forEach(t=>{
      bal = t.type==='income'? bal + t.amount : bal - t.amount;
      t.balance = bal;
    });
    this.currentBalance = bal;
  }

  renderAll(){
    this.renderSummary();
    this.renderHistory();
    this.renderManage();
    this.updateHero();
    this.updateCharts();
  }

  renderSummary(){
    const inc = this.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = this.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const final = this.currentBalance;
    const elInc = document.getElementById('totalIncome');
    const elExp = document.getElementById('totalExpense');
    const elFinal = document.getElementById('finalBalance');
    if(elInc) elInc.textContent = this.formatCurrency(inc);
    if(elExp) elExp.textContent = this.formatCurrency(exp);
    if(elFinal) {
      elFinal.textContent = this.formatCurrency(final);
      if(final>0) elFinal.className='text-xl font-bold text-emerald-600';
      else if(final<0) elFinal.className='text-xl font-bold text-rose-600';
      else elFinal.className='text-xl font-bold text-slate-600';
    }
  }

  renderHistory(filtered=null){
    const tbody = document.getElementById('historyBody');
    if(!tbody) return;
    const data = filtered || this.transactions;
    tbody.innerHTML='';
    data.slice().reverse().forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2 text-sm">${t.date}</td>
        <td class="px-3 py-2 text-sm font-medium">${t.description}</td>
        <td class="px-3 py-2 text-sm text-right">${t.type==='income'?this.formatCurrency(t.amount):'-'}</td>
        <td class="px-3 py-2 text-sm text-right">${t.type==='expense'?this.formatCurrency(t.amount):'-'}</td>
        <td class="px-3 py-2 text-sm text-right">${this.formatCurrency(t.balance)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  updateHero(){
    const hero = document.getElementById('heroBalance');
    if(hero) hero.textContent = this.formatCurrency(this.currentBalance);
  }

  updateCharts(){
    if(typeof Chart==='undefined') return;
    const inc = this.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = this.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const pieEl = document.getElementById('pieChart');
    const lineEl = document.getElementById('lineChart');
    const textColor = this.isDarkMode ? '#F1F5F9' : '#1E293B';
    if(pieEl){
      if(this.pieChart) this.pieChart.destroy();
      this.pieChart = new Chart(pieEl.getContext('2d'), {
        type:'doughnut',
        data:{ labels:['Pemasukan','Pengeluaran'], datasets:[{ data:[inc,exp], backgroundColor:['#10B981','#EF4444'] }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color: textColor}}} }
      });
    }
    if(lineEl){
      if(this.lineChart) this.lineChart.destroy();
      const labels = this.transactions.map(t=>t.date);
      const data = this.transactions.map(t=>t.balance);
      this.lineChart = new Chart(lineEl.getContext('2d'), {
        type:'line',
        data:{ labels, datasets:[{ label:'Saldo', data, borderColor:'#3B82F6', backgroundColor:'rgba(59,130,246,0.08)', tension:0.3 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textColor}}}, scales:{x:{ticks:{color:textColor}}, y:{ticks:{color:textColor}}} }
      });
    }
  }

  applyDateFilter(){
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if(!s || !e){ this.notify('Pilih rentang tanggal','error'); return; }
    const filtered = this.transactions.filter(t=> t.dateISO>=s && t.dateISO<=e);
    this.renderHistory(filtered);
  }

  resetFilter(){
    document.getElementById('startDate').value=''; document.getElementById('endDate').value='';
    this.renderHistory();
  }

  exportRange(){
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if(!s || !e){ this.notify('Pilih rentang tanggal','error'); return; }
    const filtered = this.transactions.filter(t=> t.dateISO>=s && t.dateISO<=e);
    if(!filtered.length){ this.notify('Tidak ada data pada rentang tersebut','warning'); return; }
    const data = filtered.map(t=>({Tanggal:t.date, Keterangan:t.description, Pemasukan:t.type==='income'?t.amount:0, Pengeluaran:t.type==='expense'?t.amount:0, Saldo:t.balance}));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    XLSX.writeFile(wb, `riwayat_${s}_${e}.xlsx`);
    this.notify('Export rentang berhasil','success');
  }

  exportAll(){
    if(!this.transactions.length){ this.notify('Belum ada data','warning'); return; }
    const data = this.transactions.map(t=>({Tanggal:t.date, Keterangan:t.description, Pemasukan:t.type==='income'?t.amount:0, Pengeluaran:t.type==='expense'?t.amount:0, Saldo:t.balance}));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    XLSX.writeFile(wb, `keuangan_all_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.notify('Export lengkap berhasil','success');
  }

  initDarkMode() {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.updateDarkModeIcon();
  }
  
  toggleDarkMode(){
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode);
    if(this.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.updateCharts();
    this.updateDarkModeIcon();
  }
  
  updateDarkModeIcon() {
    const iconContainer = document.getElementById('darkModeToggleTop');
    if (iconContainer) {
      iconContainer.innerHTML = this.isDarkMode ? '☀️' : '🌙';
    }
  }

  notify(msg,type='info'){ const el = document.createElement('div'); el.className=`fixed top-6 right-6 z-50 px-4 py-2 rounded shadow-lg text-white ${type==='success'?'bg-emerald-500':type==='error'?'bg-rose-500':type==='warning'?'bg-yellow-500':'bg-sky-600'}`; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); },2200); }

  formatCurrency(v){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(Math.round(v)); }
}

document.addEventListener('DOMContentLoaded', ()=>{ window.app = new FinancialManager(); });