import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { organizationService } from '../../services/organizationService';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export const EntityMasterData: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    email: '',
    mobile: '',
    address: '',
    countryId: '',
    stateId: '',
    cityId: '',
    pinCode: '',
    addressLine1: '',
    addressLine2: '',
    website: '',
    phoneNumber: '',
    orgConstitution: '',
    depotCount: 0,
    warehouseCount: 0,
    gst: '',
    pan: '',
    cin: '',
    logoUrl: '',
    accountingYearStart: '',
    costCentres: [] as Array<{ name: string; shortName?: string; displayOrder?: number }>,
    branches: [] as Array<{ name: string; shortName?: string; address?: string; gstNumber?: string }>,
  });

  const { data: countriesData } = useQuery(['master-countries'], async () => {
    const res = await masterDataService.getCountries();
    return res.data.data || res.data;
  });
  const { data: orgConstitutionsData } = useQuery(['master-org-constitutions'], async () => {
    const res = await masterDataService.getOrgConstitutions();
    return res.data.data || res.data;
  });

  const { data: statesData } = useQuery(
    ['master-states', formData.countryId],
    async () => {
      const res = await masterDataService.getStates(formData.countryId);
      return res.data.data || res.data;
    },
    { enabled: !!formData.countryId }
  );

  const { data: citiesData } = useQuery(
    ['master-cities', formData.stateId],
    async () => {
      const res = await masterDataService.getCities(formData.stateId);
      return res.data.data || res.data;
    },
    { enabled: !!formData.stateId }
  );

  // Get user's organization
  const { data: orgData, isLoading } = useQuery(
    ['admin-organization'],
    async () => {
      // Use admin endpoint if user is admin, otherwise use super-admin endpoint
      if (user?.role === 'admin') {
        const response = await organizationService.getMyOrganization();
        return response.data.data; // Can be null if admin doesn't have organization yet
      } else if (user?.organizationId) {
        const response = await organizationService.getById(user.organizationId);
        return response.data.data;
      }
      return null;
    },
    { enabled: !!user }
  );

  useEffect(() => {
    if (orgData) {
      setFormData({
        name: orgData.name || '',
        shortName: orgData.shortName || '',
        email: orgData.email || '',
        mobile: orgData.mobile || '',
        address: orgData.address || '',
        countryId: orgData.countryId || '',
        stateId: orgData.stateId || '',
        cityId: orgData.cityId || '',
        pinCode: orgData.pinCode || '',
        addressLine1: orgData.addressLine1 || '',
        addressLine2: orgData.addressLine2 || '',
        website: orgData.website || '',
        phoneNumber: orgData.phoneNumber || '',
        orgConstitution: orgData.orgConstitution || '',
        depotCount: orgData.depotCount ?? 0,
        warehouseCount: orgData.warehouseCount ?? 0,
        gst: orgData.gst || '',
        pan: orgData.pan || '',
        cin: orgData.cin || '',
        logoUrl: orgData.logoUrl || '',
        accountingYearStart: orgData.accountingYearStart || '',
        costCentres: Array.isArray(orgData.costCentres) ? orgData.costCentres : [],
        branches: Array.isArray(orgData.branches) ? orgData.branches : [],
      });
    }
  }, [orgData]);

  const updateMutation = useMutation(
    (data: any) => {
      // Use admin endpoint if user is admin, otherwise use super-admin endpoint
      return user?.role === 'admin'
        ? organizationService.updateMyOrganization(data)
        : organizationService.update(user?.organizationId!, data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('admin-organization');
        toast.success('Organization details updated successfully!');
      },
      onError: (error: any) => {
        toast.error(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bulkFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const handleLogoClick = () => {
    if (!isUploadingLogo && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate();
      toast.success('Template downloaded. Fill it and upload to bulk update.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: (res) => {
        const data = res.data?.data;
        if (data) {
          const { updated, errors } = data;
          const parts = [];
          if (updated.organizations) parts.push(`${updated.organizations} organizations`);
          if (updated.cost_centres) parts.push(`${updated.cost_centres} cost centres`);
          if (updated.branches) parts.push(`${updated.branches} branches`);
          if (updated.client_entities) parts.push(`${updated.client_entities} client entities`);
          if (updated.client_entity_services) parts.push(`${updated.client_entity_services} client services`);
          if (parts.length) toast.success(`Updated: ${parts.join(', ')}`);
          if (errors.length) {
            errors.slice(0, 5).forEach((e) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (errors.length > 5) toast.error(`… and ${errors.length - 5} more errors`);
          }
        }
        queryClient.invalidateQueries('admin-organization');
        queryClient.invalidateQueries(['client-entities']);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
      onSettled: () => {
        setIsBulkUploading(false);
      },
    }
  );

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    setIsBulkUploading(true);
    bulkUploadMutation.mutate(file);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, GIF, WEBP, or SVG)');
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      // Use the api service which handles authentication automatically
      const response = await api.post('/messages/upload/image', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = response.data;

      if (result.success && result.data?.url) {
        // Construct full URL if it's a relative path
        let imageUrl = result.data.url;
        if (imageUrl.startsWith('/')) {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          imageUrl = `${apiUrl}${imageUrl}`;
        }
        setFormData(prev => ({ ...prev, logoUrl: imageUrl }));
        toast.success('Logo uploaded successfully!');
      } else {
        console.error('Unexpected response format:', result);
        throw new Error(result.error || 'Failed to upload logo - invalid response');
      }
    } catch (error: any) {
      console.error('Logo upload error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Please try again';
      toast.error(`Error uploading logo: ${errorMessage}`);
    } finally {
      setIsUploadingLogo(false);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-text-muted">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 scroll-smooth">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-text-main tracking-tight mb-2">
                Entity Master Data
              </h1>
              <p className="text-text-muted text-sm">
                Manage organization details, statutory information, and system defaults.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2.5 text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-sm transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={updateMutation.isLoading}
                className="bg-primary hover:bg-primary-700 text-white font-semibold py-2.5 px-6 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                <span>{updateMutation.isLoading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* Bulk update: Download template / Upload file */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">upload_file</span>
              Bulk update from Excel
            </h2>
            <p className="text-slate-600 text-sm mb-4">
              Download the template, fill in your data, then upload the file to update organizations, cost centres, branches, client entities, and client entity services in one go.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                {isDownloadingTemplate ? 'Downloading...' : 'Download template'}
              </button>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBulkFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={isBulkUploading}
                className="px-4 py-2.5 bg-primary hover:bg-primary-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                {isBulkUploading ? 'Uploading...' : 'Upload file'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            {/* Organization Details */}
            <div className="p-6 md:p-8 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">business</span>
                Organization Details
              </h2>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3 flex flex-col gap-2">
                  <label className="block text-sm font-medium text-slate-700">Company Logo</label>
                  <div 
                    onClick={handleLogoClick}
                    className="flex-1 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center min-h-[220px] group relative overflow-hidden"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                    />
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    {isUploadingLogo ? (
                      <div className="flex flex-col items-center justify-center relative z-10">
                        <div className="size-14 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                        <p className="text-sm font-bold text-slate-900">Uploading...</p>
                        <p className="text-xs text-slate-500 mt-1">Please wait</p>
                      </div>
                    ) : formData.logoUrl ? (
                      <div className="relative w-full h-full group/logo">
                        <img
                          src={formData.logoUrl}
                          alt="Company Logo"
                          className="w-full h-full object-contain rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Click to change</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="size-14 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 group-hover:border-primary/30 transition-all relative z-10">
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-3xl">
                            cloud_upload
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 relative z-10">Click to upload logo</p>
                        <p className="text-xs text-slate-500 mt-1 relative z-10">SVG, PNG, JPG (Max 2MB)</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-full md:w-2/3 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgName">
                      Organization Name
                    </label>
                    <input
                      id="orgName"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                      placeholder="e.g. Acme Corporation Pvt Ltd"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgShortName">
                        Short Name
                      </label>
                      <input
                        id="orgShortName"
                        type="text"
                        value={formData.shortName}
                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="e.g. SNKFCA"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgPhone">
                        Phone Number
                      </label>
                      <input
                        id="orgPhone"
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="e.g. +91..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgEmail">
                        Email Address
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                          mail
                        </span>
                        <input
                          id="orgEmail"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 pl-10 pr-3 transition-shadow"
                          placeholder="admin@company.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgMobile">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                          phone
                        </span>
                        <input
                          id="orgMobile"
                          type="tel"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 pl-10 pr-3 transition-shadow"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgWebsite">
                        Website
                      </label>
                      <input
                        id="orgWebsite"
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgConstitution">
                        Org Constitution
                      </label>
                      <select
                        id="orgConstitution"
                        value={formData.orgConstitution}
                        onChange={(e) => setFormData({ ...formData, orgConstitution: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                      >
                        <option value="">Select</option>
                        {(orgConstitutionsData || []).map((o: any) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgAddress">
                      Registered Address
                    </label>
                    <textarea
                      id="orgAddress"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow resize-none"
                      placeholder="Enter full office address including zip code..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Country</label>
                      <select
                        value={formData.countryId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            countryId: e.target.value,
                            stateId: '',
                            cityId: '',
                          })
                        }
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                      >
                        <option value="">Select</option>
                        {(countriesData || []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
                      <select
                        value={formData.stateId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stateId: e.target.value,
                            cityId: '',
                          })
                        }
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        disabled={!formData.countryId}
                      >
                        <option value="">Select</option>
                        {(statesData || []).map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                      <select
                        value={formData.cityId}
                        onChange={(e) => setFormData({ ...formData, cityId: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        disabled={!formData.stateId}
                      >
                        <option value="">Select</option>
                        {(citiesData || []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Pin Code</label>
                      <input
                        type="text"
                        value={formData.pinCode}
                        onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="530003"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Address Line 1</label>
                      <input
                        type="text"
                        value={formData.addressLine1}
                        onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="Address first line"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Address Line 2</label>
                      <input
                        type="text"
                        value={formData.addressLine2}
                        onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                        className="w-full rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 transition-shadow"
                        placeholder="Address second line"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statutory Details */}
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">gavel</span>
                Statutory Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="gstNo">
                    GST Number
                  </label>
                  <input
                    id="gstNo"
                    type="text"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="panNo">
                    PAN Number
                  </label>
                  <input
                    id="panNo"
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="cinNo">
                    CIN Number
                  </label>
                  <input
                    id="cinNo"
                    type="text"
                    value={formData.cin}
                    onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
                    placeholder="L12345MH2023PLC123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="accountingYearStart">
                    Accounting Year Start
                  </label>
                  <input
                    id="accountingYearStart"
                    type="date"
                    value={formData.accountingYearStart}
                    onChange={(e) => setFormData({ ...formData, accountingYearStart: e.target.value })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Depot Count</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.depotCount}
                    onChange={(e) => setFormData({ ...formData, depotCount: Number(e.target.value || 0) })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Warehouse Count</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.warehouseCount}
                    onChange={(e) => setFormData({ ...formData, warehouseCount: Number(e.target.value || 0) })}
                    className="w-full rounded-lg border-slate-200 bg-white text-slate-900 text-sm focus:border-primary focus:ring-primary py-2.5 px-3"
                  />
                </div>
              </div>
            </div>

            {/* Cost Centres */}
            <div className="p-6 md:p-8 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
                  Cost Centres
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      costCentres: [...formData.costCentres, { name: '', shortName: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.costCentres.map((cc, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                    <input
                      className="md:col-span-3 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="Cost Centre Name"
                      value={cc.name}
                      onChange={(e) => {
                        const next = [...formData.costCentres];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, costCentres: next });
                      }}
                    />
                    <input
                      className="md:col-span-1 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="Short Name"
                      value={cc.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.costCentres];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, costCentres: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = formData.costCentres.filter((_, i) => i !== idx);
                        setFormData({ ...formData, costCentres: next });
                      }}
                      className="md:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.costCentres.length === 0 && (
                  <div className="text-sm text-slate-500">No cost centres yet.</div>
                )}
              </div>
            </div>

            {/* Branches */}
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-2xl">apartment</span>
                  Branches
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      branches: [...formData.branches, { name: '', shortName: '', address: '', gstNumber: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.branches.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                    <input
                      className="md:col-span-2 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="Branch Name"
                      value={b.name}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <input
                      className="md:col-span-1 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="Short"
                      value={b.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <input
                      className="md:col-span-2 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="Address"
                      value={b.address || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], address: e.target.value };
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <input
                      className="md:col-span-1 rounded-lg border-slate-200 bg-slate-50/30 text-slate-900 text-sm py-2.5 px-3"
                      placeholder="GST"
                      value={(b as any).gstNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], gstNumber: e.target.value.toUpperCase() } as any;
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = formData.branches.filter((_, i) => i !== idx);
                        setFormData({ ...formData, branches: next });
                      }}
                      className="md:col-span-6 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.branches.length === 0 && <div className="text-sm text-slate-500">No branches yet.</div>}
              </div>
            </div>

          </form>
        </div>
      </main>
    </AdminLayout>
  );
};

