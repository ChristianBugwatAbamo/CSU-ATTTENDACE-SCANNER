import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Shield, UserCheck, X, Sparkles, RefreshCw, Layers } from 'lucide-react';

export default function CadetRoster({ cadets, onAddCadet, onUpdateCadet, onDeleteCadet, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [battalionFilter, setBattalionFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [platoonFilter, setPlatoonFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCadet, setEditingCadet] = useState(null);
  const [formError, setFormError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'Basic Cadet',
    rank: 'Cadet',
    battalion: '1st Battalion',
    company: 'Alpha',
    platoon: '1st Platoon',
    designation: 'N/A'
  });

  const officerRanks = [
    'Cadet 2LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 4CL',
    'Cadet 1LT (ROTC) 3CL',
    'Cadet CPT (ROTC) 3CL',
    'Cadet CPT (ROTC) 2CL',
    'Cadet MAJ (ROTC) 2CL',
    'Cadet LT COL (ROTC) 1CL',
    'Cadet COL (ROTC) 1CL'
  ];

  const officerDesignations = [
    'None',
    'Corps Commander',
    'Deputy Commander',
    'Adjutant',
    'S1 Brigade',
    'S2 Brigade',
    'S3 Brigade',
    'S4 Brigade',
    'S7 Brigade',
    '1st Bn Commander',
    '2nd Bn Commander',
    'Alpha Coy Commander',
    'Bravo Coy Commander',
    'Charlie Coy Commander',
    'Delta Coy Commander',
    'Platoon Leader'
  ];

  const handleOpenAddModal = () => {
    setEditingCadet(null);
    setFormError('');
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setFormData({
      id: `221-${randomNum}`,
      name: '',
      type: 'Basic Cadet',
      rank: 'Cadet',
      battalion: '1st Battalion',
      company: 'Alpha',
      platoon: '1st Platoon',
      designation: 'N/A'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cadet) => {
    setEditingCadet(cadet);
    setFormError('');
    setFormData({
      id: cadet.id,
      name: cadet.name,
      type: cadet.type || 'Basic Cadet',
      rank: cadet.rank || 'Cadet',
      battalion: cadet.battalion || '1st Battalion',
      company: cadet.company || 'Alpha',
      platoon: cadet.platoon || '1st Platoon',
      designation: cadet.designation || 'N/A'
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType) => {
    if (newType === 'Basic Cadet') {
      setFormData(prev => ({ ...prev, type: newType, rank: 'Cadet', designation: 'N/A' }));
    } else {
      setFormData(prev => ({ ...prev, type: newType, rank: 'Cadet 2LT (ROTC) 4CL', designation: 'Platoon Leader' }));
    }
  };

  const handleNameInput = (val) => {
    setFormData(prev => ({ ...prev, name: val.toUpperCase() }));
  };

  const handleIdInput = (val) => {
    setFormData(prev => ({ ...prev, id: val.toUpperCase() }));
  };

  const handleGenerateFullRoster = async () => {
    if (!window.confirm("Auto-generate the complete CSU ROTC Echelon Roster (1,184 Cadets: 2 Battalions × 4 Companies × 4 Platoons × 37 Cadets + Brigade HQ Staff)? This will populate the master database.")) {
      return;
    }

    try {
      setIsGenerating(true);
      const res = await fetch('/api/cadets/generate-hierarchy-roster', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || `Successfully generated ${data.totalCadets} Cadets!`);
        if (onRefresh) onRefresh();
      } else {
        alert("Failed to generate echelon roster.");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting server to generate roster.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.id.trim() || !formData.name.trim()) {
      setFormError('Cadet ID and Full Name are required.');
      return;
    }

    const idRegex = /^221-\d{5}$/;
    if (!idRegex.test(formData.id)) {
      setFormError('Cadet ID must follow the format 221-XXXXX (e.g. 221-01234).');
      return;
    }

    if (!formData.name.includes(',')) {
      setFormError('Cadet Name must follow the format: LAST NAME, FIRST NAME MIDDLE INITIAL (e.g. DELA CRUZ, JUAN A.).');
      return;
    }

    if (editingCadet) {
      onUpdateCadet(formData);
    } else {
      if (cadets.some(c => c.id === formData.id)) {
        setFormError(`Cadet ID ${formData.id} is already registered!`);
        return;
      }
      onAddCadet(formData);
    }

    setIsModalOpen(false);
  };

  // Filtered Cadets
  const filteredCadets = cadets.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBattalion = battalionFilter === 'ALL' || c.battalion === battalionFilter;
    const matchesCompany = companyFilter === 'ALL' || c.company === companyFilter;
    const matchesPlatoon = platoonFilter === 'ALL' || c.platoon === platoonFilter;
    const matchesType = typeFilter === 'ALL' || c.type === typeFilter;
    return matchesSearch && matchesBattalion && matchesCompany && matchesPlatoon && matchesType;
  });

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title">MASTER CADET DIRECTORY</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Full Unit Strength: <strong>1,184 Cadets</strong> (1 Brigade HQ • 2 Battalions • 4 Coys • 4 Platoons × 37 Cadets)
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-gold"
              onClick={handleGenerateFullRoster}
              disabled={isGenerating}
              title="Populate complete 1,184-cadet structure"
            >
              <Sparkles size={16} /> {isGenerating ? 'Generating 1,184...' : 'Populate 1,184 Unit Roster'}
            </button>
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={18} /> Add New Cadet
            </button>
          </div>
        </div>

        {/* Search & Comprehensive Echelon Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Cadet Name or ID..."
              style={{ paddingLeft: '38px', width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            
            {/* Battalion Filter */}
            <select className="form-control" value={battalionFilter} onChange={(e) => setBattalionFilter(e.target.value)}>
              <option value="ALL">All Battalions (1,184)</option>
              <option value="1st Battalion">1st Battalion (592)</option>
              <option value="2nd Battalion">2nd Battalion (592)</option>
              <option value="Brigade HQ">Brigade HQ Staff</option>
            </select>

            {/* Company Filter */}
            <select className="form-control" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="ALL">All Companies</option>
              <option value="Alpha">Alpha Coy</option>
              <option value="Bravo">Bravo Coy</option>
              <option value="Charlie">Charlie Coy</option>
              <option value="Delta">Delta Coy</option>
              <option value="Headquarters">Headquarters</option>
            </select>

            {/* Platoon Filter */}
            <select className="form-control" value={platoonFilter} onChange={(e) => setPlatoonFilter(e.target.value)}>
              <option value="ALL">All Platoons (37/Pltn)</option>
              <option value="1st Platoon">1st Platoon (37)</option>
              <option value="2nd Platoon">2nd Platoon (37)</option>
              <option value="3rd Platoon">3rd Platoon (37)</option>
              <option value="4th Platoon">4th Platoon (37)</option>
            </select>

            {/* Classification Filter */}
            <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">All Categories</option>
              <option value="Basic Cadet">Basic Cadets</option>
              <option value="Cadet Officer">Cadet Officers</option>
            </select>
          </div>
        </div>

        {/* Results Counter Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', padding: '0 4px' }}>
          <span>Showing <strong>{filteredCadets.length}</strong> of <strong>{cadets.length}</strong> registered cadets</span>
          <span>Fixed Platoon Standard: <strong>37 Cadets</strong></span>
        </div>

        {/* Cadets Table */}
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Cadet ID</th>
                <th>Full Name (LAST, FIRST M.I.)</th>
                <th>Echelon / Battalion</th>
                <th>Company</th>
                <th>Platoon (37/Pltn)</th>
                <th>Rank</th>
                <th>Category</th>
                <th>Designation</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCadets.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No cadet records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredCadets.slice(0, 150).map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>{c.battalion || '1st Battalion'}</span></td>
                    <td><span className="badge badge-company">{c.company}</span></td>
                    <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>{c.platoon || '1st Platoon'}</span></td>
                    <td style={{ fontWeight: 700 }}>{c.rank}</td>
                    <td>
                      <span className={`badge ${c.type === 'Cadet Officer' ? 'badge-officer' : 'badge-basic'}`}>
                        {c.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.designation || 'N/A'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(c)} title="Edit Cadet">
                          <Edit size={14} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => onDeleteCadet(c.id)} title="Delete Cadet">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filteredCadets.length > 150 && (
            <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
              Showing first 150 of {filteredCadets.length} cadets. Use Battalion / Company / Platoon filters to narrow results.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Cadet Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 style={{ fontFamily: 'Oswald, sans-serif' }}>{editingCadet ? 'EDIT CADET RECORD' : 'REGISTER NEW CADET'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #fca5a5' }}>
                    {formError}
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-group">
                    <label>Cadet Classification</label>
                    <select
                      className="form-control"
                      value={formData.type}
                      onChange={(e) => handleTypeChange(e.target.value)}
                    >
                      <option value="Basic Cadet">Basic Cadet</option>
                      <option value="Cadet Officer">Cadet Officer</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Cadet ID (221-XXXXX)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="221-01234"
                      value={formData.id}
                      onChange={(e) => handleIdInput(e.target.value)}
                      disabled={!!editingCadet}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Full Name (LAST NAME, FIRST NAME M.I.)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="DELA CRUZ, JUAN A."
                    value={formData.name}
                    onChange={(e) => handleNameInput(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Enforced format: LAST NAME, FIRST NAME MIDDLE INITIAL
                  </small>
                </div>

                {/* Echelon Hierarchy: Battalion, Company, Platoon */}
                <div className="form-grid" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Battalion</label>
                    <select
                      className="form-control"
                      value={formData.battalion}
                      onChange={(e) => setFormData({ ...formData, battalion: e.target.value })}
                    >
                      <option value="1st Battalion">1st Battalion</option>
                      <option value="2nd Battalion">2nd Battalion</option>
                      <option value="Brigade HQ">Brigade HQ</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Company Assignment</label>
                    <select
                      className="form-control"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    >
                      <option value="Alpha">Alpha Company</option>
                      <option value="Bravo">Bravo Company</option>
                      <option value="Charlie">Charlie Company</option>
                      <option value="Delta">Delta Company</option>
                      <option value="Headquarters">Headquarters</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Platoon (Fixed 37 / Pltn)</label>
                    <select
                      className="form-control"
                      value={formData.platoon}
                      onChange={(e) => setFormData({ ...formData, platoon: e.target.value })}
                    >
                      <option value="1st Platoon">1st Platoon (37)</option>
                      <option value="2nd Platoon">2nd Platoon (37)</option>
                      <option value="3rd Platoon">3rd Platoon (37)</option>
                      <option value="4th Platoon">4th Platoon (37)</option>
                      <option value="Brigade Staff">Brigade Staff</option>
                      <option value="Battalion Staff">Battalion Staff</option>
                    </select>
                  </div>

                  {/* Rank Field - Dynamic based on type */}
                  <div className="form-group">
                    <label>Rank</label>
                    {formData.type === 'Basic Cadet' ? (
                      <input
                        type="text"
                        className="form-control"
                        value="Cadet"
                        disabled
                        style={{ backgroundColor: '#f3f4f6' }}
                      />
                    ) : (
                      <select
                        className="form-control"
                        value={formData.rank}
                        onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                      >
                        {officerRanks.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Designation Field */}
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Designation / Role</label>
                  {formData.type === 'Cadet Officer' ? (
                    <select
                      className="form-control"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    >
                      {officerDesignations.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Platoon Guide, Squad Leader, or N/A"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCadet ? 'Save Changes' : 'Register Cadet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
