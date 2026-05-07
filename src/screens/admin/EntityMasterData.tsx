import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { organizationService } from '../../services/organizationService';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { getBackendBaseUrlWithSlash } from '../../config/env';
import { masterDataService } from '../../services/masterDataService';

const mapOrgToFormState = (orgData: any) => ({
  name: orgData.name || '',
  shortName: orgData.shortName || '',
  email: orgData.email || '',
  mobile: orgData.mobile || '',
  address: orgData.address || '',
  countryId: orgData.countryId || '',
  stateId: orgData.stateId || '',
  cityId: orgData.cityId || '',
  countryName: orgData.country?.name || '',
  stateName: orgData.state?.name || '',
  cityName: orgData.city?.name || '',
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
  depots: Array.isArray(orgData.depots) ? orgData.depots : [],
  warehouses: Array.isArray(orgData.warehouses) ? orgData.warehouses : [],
});

export const EntityMasterData: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    email: '',
    mobile: '',
    address: '',
    countryId: '',
    stateId: '',
    cityId: '',
    countryName: '',
    stateName: '',
    cityName: '',
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
    depots: [] as Array<{ name: string; shortName?: string; displayOrder?: number }>,
    warehouses: [] as Array<{ name: string; shortName?: string; address?: string; gstNumber?: string }>,
  });
  const [showOrganisationMore, setShowOrganisationMore] = useState(false);
  const [expandedCostCentreRows, setExpandedCostCentreRows] = useState<Record<number, boolean>>({});
  const [expandedBranchRows, setExpandedBranchRows] = useState<Record<number, boolean>>({});
  const [expandedDepotRows, setExpandedDepotRows] = useState<Record<number, boolean>>({});
  const [expandedWarehouseRows, setExpandedWarehouseRows] = useState<Record<number, boolean>>({});
  const [selectedEntitySection, setSelectedEntitySection] = useState<'costCentre' | 'branches' | 'depot' | 'warehouse' | 'project' | 'factory'>('costCentre');

  const { data: orgConstitutionsData } = useQuery(['master-org-constitutions'], async () => {
    const res = await masterDataService.getOrgConstitutions();
    return res.data.data || res.data;
  });

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
    if (orgData && !isEditing) {
      console.log('[EntityMaster] org data loaded', { name: orgData.name, country: orgData.country?.name, state: orgData.state?.name, city: orgData.city?.name });
      setFormData(mapOrgToFormState(orgData));
    }
  }, [orgData, isEditing]);

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
        setIsEditing(false);
        toast.success('Organization details updated successfully!');
      },
      onError: (error: any) => {
        toast.error(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    console.log('[EntityMaster] form submit', { name: formData.name, countryId: formData.countryId, stateId: formData.stateId, cityId: formData.cityId });
    updateMutation.mutate(formData);
  };

  const handleCancelEdit = () => {
    if (orgData) {
      setFormData(mapOrgToFormState(orgData));
    }
    setIsEditing(false);
  };

  const locked = !isEditing;
  const fieldClass = (base: string) =>
    `${base} border border-slate-200 ${locked ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'bg-white'}`;

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
      await entityMasterBulkService.getTemplate('organisation');
      toast.success('Entity Master template downloaded. Fill it and upload to bulk update.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        try {
          const status = await entityMasterBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            toast.success('Entity Master bulk upload completed.');
          } else {
            toast.warning('Bulk upload finished with errors.');
          }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (status.errors.length > 5) toast.error(`… and ${status.errors.length - 5} more errors`);
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
        }
        queryClient.invalidateQueries('admin-organization');
        queryClient.invalidateQueries(['client-entities']);
        queryClient.invalidateQueries('employees');
        queryClient.invalidateQueries(['task-services']);
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
          imageUrl = `${getBackendBaseUrlWithSlash()}${imageUrl.replace(/^\//, '')}`;
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
      <main className="flex-1 overflow-y-auto bg-slate-100/80 p-4 md:p-6 pb-20 scroll-smooth">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 shrink-0">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-0.5">
                Entity Master Data
              </h1>
              <p className="text-slate-500 text-xs md:text-sm leading-snug">
                Manage organization details, statutory information, and system defaults.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="px-3 py-2 md:px-4 md:py-2.5 bg-white border-2 border-primary text-primary rounded-lg font-semibold text-xs md:text-sm flex items-center gap-1.5 md:gap-2 hover:bg-primary/5 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base md:text-[18px]">download</span>
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
                className="px-3 py-2 md:px-4 md:py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-xs md:text-sm flex items-center gap-1.5 md:gap-2 disabled:opacity-50 shadow-sm transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base md:text-[18px]">upload</span>
                {isBulkUploading ? 'Uploading...' : 'Upload file'}
              </button>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-2 md:px-4 bg-primary text-white font-semibold rounded-lg flex items-center gap-1.5 md:gap-2 text-xs md:text-sm shadow-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-base md:text-[18px]">edit</span>
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-xs md:text-sm whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="entity-master-form"
                    disabled={updateMutation.isLoading}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-3 md:px-5 rounded-lg flex items-center gap-1.5 md:gap-2 text-xs md:text-sm shadow-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base md:text-[18px]">save</span>
                    <span>{updateMutation.isLoading ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <form id="entity-master-form" onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            {/* Organization Details */}
            <div className="p-5 md:p-6 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">business</span>
                Organisation details
              </h2>
              <div className="flex flex-col gap-6">
                {/* Logo left; Name, Short Name, Phone on the right */}
                <div className="flex flex-col md:flex-row gap-6 md:items-start">
                  <div className="flex flex-col gap-2 w-full max-w-[220px] shrink-0 mx-auto md:mx-0">
                    <p className="text-xs text-slate-500">Additional (not in bulk template)</p>
                    <label className="block text-sm font-medium text-slate-700">Company Logo</label>
                    <div 
                      onClick={locked || isUploadingLogo ? undefined : handleLogoClick}
                      role={locked ? undefined : 'button'}
                      className={`aspect-square w-full max-w-[220px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-4 text-center group relative overflow-hidden ${
                        locked || isUploadingLogo
                          ? 'cursor-not-allowed opacity-90'
                          : 'cursor-pointer hover:bg-slate-100 hover:border-primary/50 transition-all'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo || locked}
                        className="hidden"
                      />
                      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                      {isUploadingLogo ? (
                        <div className="flex flex-col items-center justify-center relative z-10 px-2">
                          <div className="size-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-2 shadow-sm">
                            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          </div>
                          <p className="text-xs font-bold text-slate-900">Uploading...</p>
                        </div>
                      ) : formData.logoUrl ? (
                        <div className="relative w-full h-full min-h-0 flex items-center justify-center p-2 group/logo">
                          <img
                            src={formData.logoUrl}
                            alt="Company Logo"
                            className="max-w-full max-h-full object-contain rounded-lg"
                          />
                          <div className="absolute inset-2 bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-medium px-2 text-center">Click to change</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="size-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 group-hover:border-primary/30 transition-all relative z-10">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-2xl">
                              cloud_upload
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 relative z-10 leading-tight">Click to upload logo</p>
                          <p className="text-[10px] text-slate-500 mt-1 relative z-10 px-1 leading-tight">SVG, PNG, JPG (Max 2MB)</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgName">
                        Name of the Organisation
                      </label>
                      <input
                        id="orgName"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="e.g. Acme Corporation Pvt Ltd"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgShortName">
                        Short Name
                      </label>
                      <input
                        id="orgShortName"
                        type="text"
                        value={formData.shortName}
                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
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
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="e.g. +91..."
                      />
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-5">
                  <button
                    type="button"
                    onClick={() => setShowOrganisationMore((prev) => !prev)}
                    className="w-full md:w-auto px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5"
                  >
                    <span className={`material-symbols-outlined text-base transition-transform ${showOrganisationMore ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                    {showOrganisationMore ? 'Hide more details' : 'Show more details'}
                  </button>
                  {showOrganisationMore && (
                    <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgEmail">
                      E Mail ID
                    </label>
                    <div className="relative max-w-full md:max-w-xl">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                        mail
                      </span>
                      <input
                        id="orgEmail"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 pl-10 pr-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="admin@company.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="orgWebsite">
                        Web Site
                      </label>
                      <input
                        id="orgWebsite"
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
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
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
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
                  <p className="text-xs text-slate-500 mt-4 mb-1">Also in Excel: Country, State, City, Pin Code, Address Line 1/2</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Country</label>
                      <input
                        type="text"
                        value={formData.countryName}
                        onChange={(e) => setFormData({ ...formData, countryName: e.target.value })}
                        placeholder="e.g. India"
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
                      <input
                        type="text"
                        value={formData.stateName}
                        onChange={(e) => setFormData({ ...formData, stateName: e.target.value })}
                        placeholder="e.g. Maharashtra"
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                      <input
                        type="text"
                        value={formData.cityName}
                        onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
                        placeholder="e.g. Mumbai"
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Pin Code</label>
                      <input
                        type="text"
                        value={formData.pinCode}
                        onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="530003"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Address Line 1</label>
                      <input
                        type="text"
                        value={formData.addressLine1}
                        onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="Address first line"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Address Line 2</label>
                      <input
                        type="text"
                        value={formData.addressLine2}
                        onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                        disabled={locked}
                        className={fieldClass(
                          'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                        )}
                        placeholder="Address second line"
                      />
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Statutory Details */}
            <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/40">
              <h2 className="text-base font-semibold text-slate-900 mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">description</span>
                Statutory Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="gstNo">
                    GST Number
                  </label>
                  <input
                    id="gstNo"
                    type="text"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    disabled={locked}
                    className={`${fieldClass(
                      'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:border-primary focus:ring-primary focus:ring-1'
                    )}`}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="panNo">
                    PAN of the Organisation
                  </label>
                  <input
                    id="panNo"
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    disabled={locked}
                    className={`${fieldClass(
                      'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:border-primary focus:ring-primary focus:ring-1'
                    )}`}
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
                    disabled={locked}
                    className={`${fieldClass(
                      'w-full rounded-lg text-slate-900 text-sm py-2.5 px-3 uppercase font-mono tracking-wide placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:border-primary focus:ring-primary focus:ring-1'
                    )}`}
                    placeholder="L12345MH2023PLC123456"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/40">
              <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">tune</span>
                Entity Section
              </h2>
              <select
                value={selectedEntitySection}
                onChange={(e) =>
                  setSelectedEntitySection(
                    e.target.value as 'costCentre' | 'branches' | 'depot' | 'warehouse' | 'project' | 'factory'
                  )
                }
                className={fieldClass(
                  'w-full md:max-w-sm rounded-lg text-slate-900 text-sm py-2.5 px-3 transition-shadow focus:border-primary focus:ring-primary focus:ring-1'
                )}
              >
                <option value="costCentre">Cost Centre</option>
                <option value="branches">Branches</option>
                <option value="depot">Depot</option>
                <option value="warehouse">Warehouse</option>
                <option value="project">Project</option>
                <option value="factory">Factory</option>
              </select>
            </div>

            {/* Cost Centres */}
            {selectedEntitySection === 'costCentre' && (
            <div className="p-5 md:p-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">account_balance</span>
                  Cost Centres
                </h2>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      costCentres: [...formData.costCentres, { name: '', shortName: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.costCentres.map((cc, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Cost Centre Name"
                      value={cc.name}
                      onChange={(e) => {
                        const next = [...formData.costCentres];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, costCentres: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-1 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Short Name"
                      value={cc.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.costCentres];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, costCentres: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Phone Number"
                      value={(cc as any).phoneNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.costCentres];
                        next[idx] = { ...next[idx], phoneNumber: e.target.value } as any;
                        setFormData({ ...formData, costCentres: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCostCentreRows((prev) => ({ ...prev, [idx]: !prev[idx] }))
                      }
                      className="md:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm"
                    >
                      {expandedCostCentreRows[idx] ? 'Hide' : 'More'}
                    </button>
                    </div>
                    {expandedCostCentreRows[idx] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address Line 1"
                          value={(cc as any).addressLine1 || ''}
                          onChange={(e) => {
                            const next = [...formData.costCentres];
                            next[idx] = { ...next[idx], addressLine1: e.target.value } as any;
                            setFormData({ ...formData, costCentres: next });
                          }}
                        />
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address Line 2"
                          value={(cc as any).addressLine2 || ''}
                          onChange={(e) => {
                            const next = [...formData.costCentres];
                            next[idx] = { ...next[idx], addressLine2: e.target.value } as any;
                            setFormData({ ...formData, costCentres: next });
                          }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const next = formData.costCentres.filter((_, i) => i !== idx);
                        setFormData({ ...formData, costCentres: next });
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-50"
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
            )}

            {/* Branches */}
            {selectedEntitySection === 'branches' && (
            <div className="p-5 md:p-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">apartment</span>
                  Branches
                </h2>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      branches: [...formData.branches, { name: '', shortName: '', address: '', gstNumber: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.branches.map((b, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Branch Name"
                      value={b.name}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-1 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Short"
                      value={b.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Phone Number"
                      value={(b as any).phoneNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], phoneNumber: e.target.value } as any;
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedBranchRows((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="md:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm"
                    >
                      {expandedBranchRows[idx] ? 'Hide' : 'More'}
                    </button>
                    </div>
                    {expandedBranchRows[idx] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address"
                          value={b.address || ''}
                          onChange={(e) => {
                            const next = [...formData.branches];
                            next[idx] = { ...next[idx], address: e.target.value };
                            setFormData({ ...formData, branches: next });
                          }}
                        />
                    <input
                      disabled={locked}
                      className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="GST"
                      value={(b as any).gstNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.branches];
                        next[idx] = { ...next[idx], gstNumber: e.target.value.toUpperCase() } as any;
                        setFormData({ ...formData, branches: next });
                      }}
                    />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const next = formData.branches.filter((_, i) => i !== idx);
                        setFormData({ ...formData, branches: next });
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.branches.length === 0 && <div className="text-sm text-slate-500">No branches yet.</div>}
              </div>
            </div>
            )}

            {/* Depot */}
            {selectedEntitySection === 'depot' && (
            <div className="p-5 md:p-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">local_shipping</span>
                  Depot
                </h2>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      depots: [...formData.depots, { name: '', shortName: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.depots.map((d, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Depot Name"
                      value={d.name}
                      onChange={(e) => {
                        const next = [...formData.depots];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, depots: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-1 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Short Name"
                      value={d.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.depots];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, depots: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Phone Number"
                      value={(d as any).phoneNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.depots];
                        next[idx] = { ...next[idx], phoneNumber: e.target.value } as any;
                        setFormData({ ...formData, depots: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedDepotRows((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="md:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm"
                    >
                      {expandedDepotRows[idx] ? 'Hide' : 'More'}
                    </button>
                    </div>
                    {expandedDepotRows[idx] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address Line 1"
                          value={(d as any).addressLine1 || ''}
                          onChange={(e) => {
                            const next = [...formData.depots];
                            next[idx] = { ...next[idx], addressLine1: e.target.value } as any;
                            setFormData({ ...formData, depots: next });
                          }}
                        />
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address Line 2"
                          value={(d as any).addressLine2 || ''}
                          onChange={(e) => {
                            const next = [...formData.depots];
                            next[idx] = { ...next[idx], addressLine2: e.target.value } as any;
                            setFormData({ ...formData, depots: next });
                          }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const next = formData.depots.filter((_, i) => i !== idx);
                        setFormData({ ...formData, depots: next });
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.depots.length === 0 && (
                  <div className="text-sm text-slate-500">No depots yet.</div>
                )}
              </div>
            </div>
            )}

            {/* Warehouse */}
            {selectedEntitySection === 'warehouse' && (
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">warehouse</span>
                  Warehouse
                </h2>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      warehouses: [...formData.warehouses, { name: '', shortName: '', address: '', gstNumber: '' }],
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              <div className="space-y-3">
                {formData.warehouses.map((w, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Warehouse Name"
                      value={w.name}
                      onChange={(e) => {
                        const next = [...formData.warehouses];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setFormData({ ...formData, warehouses: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-1 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Short"
                      value={w.shortName || ''}
                      onChange={(e) => {
                        const next = [...formData.warehouses];
                        next[idx] = { ...next[idx], shortName: e.target.value };
                        setFormData({ ...formData, warehouses: next });
                      }}
                    />
                    <input
                      disabled={locked}
                      className={fieldClass('md:col-span-2 rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="Phone Number"
                      value={(w as any).phoneNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.warehouses];
                        next[idx] = { ...next[idx], phoneNumber: e.target.value } as any;
                        setFormData({ ...formData, warehouses: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedWarehouseRows((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="md:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm"
                    >
                      {expandedWarehouseRows[idx] ? 'Hide' : 'More'}
                    </button>
                    </div>
                    {expandedWarehouseRows[idx] && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          disabled={locked}
                          className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                          placeholder="Address"
                          value={w.address || ''}
                          onChange={(e) => {
                            const next = [...formData.warehouses];
                            next[idx] = { ...next[idx], address: e.target.value };
                            setFormData({ ...formData, warehouses: next });
                          }}
                        />
                    <input
                      disabled={locked}
                      className={fieldClass('rounded-lg text-slate-900 text-sm py-2.5 px-3')}
                      placeholder="GST"
                      value={(w as any).gstNumber || ''}
                      onChange={(e) => {
                        const next = [...formData.warehouses];
                        next[idx] = { ...next[idx], gstNumber: e.target.value.toUpperCase() } as any;
                        setFormData({ ...formData, warehouses: next });
                      }}
                    />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const next = formData.warehouses.filter((_, i) => i !== idx);
                        setFormData({ ...formData, warehouses: next });
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {formData.warehouses.length === 0 && <div className="text-sm text-slate-500">No warehouses yet.</div>}
              </div>
            </div>
            )}

            {(selectedEntitySection === 'project' || selectedEntitySection === 'factory') && (
              <div className="p-5 md:p-6">
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  {selectedEntitySection === 'project'
                    ? 'Project section will be mapped here.'
                    : 'Factory section will be mapped here.'}
                </div>
              </div>
            )}

          </form>
        </div>
      </main>
    </AdminLayout>
  );
};

