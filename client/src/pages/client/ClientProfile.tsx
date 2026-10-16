import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import { Avatar, Modal } from '../../components/ui';
import { vehicleBrands, vehicleModels } from '../../data/mockData';
import type { Vehicle } from '../../types';
import {
  User, Mail, Phone, MapPin, Car, Plus, Trash2,
  Save, ShieldCheck, BellRing, Check
} from 'lucide-react';

export const ClientProfile: React.FC = () => {
  const { currentClient, updateClient, addToast } = useStore();

  const [name, setName] = useState(currentClient.name);
  const [email] = useState(currentClient.email);
  const [phone, setPhone] = useState(currentClient.phone);
  const [city, setCity] = useState(currentClient.city);
  const [address, setAddress] = useState(currentClient.address);

  // New vehicle modal
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [newBrand, setNewBrand] = useState('Toyota');
  const [newModel, setNewModel] = useState('Corolla');
  const [newYear, setNewYear] = useState(2022);
  const [newEngine, setNewEngine] = useState('1.8L Hybrid');

  const modelsForBrand = vehicleModels[newBrand] || ['Standard'];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const saved = await clientApiRoutes.profile({ name, phone, city, address, vehicles: currentClient.savedVehicles }); updateClient({ name: saved.name, phone: saved.phone ?? '', city: saved.city ?? '', address: saved.address ?? '' }); addToast('success', 'Profile updated successfully'); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Profile could not be saved.'); }
  };

  const handleAddVehicle = async () => {
    const newVehicle: Vehicle = {
      id: `v-${Date.now()}`,
      brand: newBrand,
      model: newModel,
      year: newYear,
      engine: newEngine,
    };

    const savedVehicles = [...currentClient.savedVehicles, newVehicle];
    try { const saved = await clientApiRoutes.profile({ name: currentClient.name, phone: currentClient.phone, city: currentClient.city, address: currentClient.address, vehicles: savedVehicles }); updateClient({ savedVehicles: saved.vehicles }); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Vehicle could not be saved.'); return; }

    setIsAddVehicleOpen(false);
    addToast('success', `${newBrand} ${newModel} added to your garage`);
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const savedVehicles = currentClient.savedVehicles.filter(v => v.id !== vehicleId);
    try { const saved = await clientApiRoutes.profile({ name: currentClient.name, phone: currentClient.phone, city: currentClient.city, address: currentClient.address, vehicles: savedVehicles }); updateClient({ savedVehicles: saved.vehicles }); addToast('info', 'Vehicle removed from garage'); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Vehicle could not be removed.'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Client Profile</h1>
        <p className="text-sm text-text-secondary">
          Manage your account profile, delivery addresses, and saved garage vehicles.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="card p-6 flex flex-col sm:flex-row items-center gap-5">
        <Avatar name={currentClient.name} size="lg" className="w-16 h-16 text-xl" />
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-lg font-bold text-navy-900">{currentClient.name}</h2>
          <p className="text-xs text-text-secondary">{currentClient.email}{currentClient.city ? ` • ${currentClient.city}` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700">
              Client account
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-accent">
              {currentClient.savedVehicles.length} Saved Vehicles
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveProfile} className="card p-6 space-y-6">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-2 border-b border-border">
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              value={email}
              className="input-field"
              readOnly
              required
            />
          </div>

          <div>
            <label className="label">Phone Number (Private)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">City / Region</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Default Shipping Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <button type="submit" className="btn-primary flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </form>

      {/* Saved Vehicles Garage */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              My Garage (Saved Vehicles)
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Easily autofill part requests by selecting your saved vehicles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddVehicleOpen(true)}
            className="btn-accent text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Vehicle
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentClient.savedVehicles.map((v) => (
            <div
              key={v.id}
              className="p-4 rounded-xl border border-border bg-surface-secondary/40 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-accent flex items-center justify-center font-bold text-sm">
                  🚗
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy-900">{v.brand} {v.model}</h4>
                  <p className="text-xs text-text-secondary font-medium">{v.year} • {v.engine}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteVehicle(v.id)}
                className="p-1 text-text-tertiary hover:text-danger rounded-lg transition-colors"
                title="Remove vehicle"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      <Modal
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        title="Add Vehicle to Garage"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Brand</label>
            <select
              value={newBrand}
              onChange={(e) => {
                setNewBrand(e.target.value);
                setNewModel(vehicleModels[e.target.value]?.[0] || 'Standard');
              }}
              className="select-field"
            >
              {vehicleBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Model</label>
            <select
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="select-field"
            >
              {modelsForBrand.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                min="1990"
                max="2026"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value) || 2022)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Engine / Trim</label>
              <input
                type="text"
                placeholder="e.g. 1.6L TDI"
                value={newEngine}
                onChange={(e) => setNewEngine(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddVehicleOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddVehicle}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={15} /> Add to Garage
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientProfile;

