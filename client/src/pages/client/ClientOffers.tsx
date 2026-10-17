import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { StatusBadge, SearchInput, Rating, VerifiedBadge, Avatar, Tabs, Modal } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { Offer } from '../../types';
import {
  Tag, Filter, ArrowUpDown, ArrowRight, ShieldCheck,
  Truck, CheckCircle, Scale, X, AlertCircle
} from 'lucide-react';

export const ClientOffers: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, requests, offers, clientDataLoadState, clientDataLoadErrors } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'rating' | 'newest'>('newest');

  // Compare mode (up to 3 offers)
  const [comparingOffers, setComparingOffers] = useState<Offer[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Offers for current client's requests
  const myRequests = requests.filter(r => r.clientId === currentClient.id);
  const myOffers = offers;
  const offerTotal = (offer: Offer) => offer.price * offer.quantity + offer.deliveryCost;

  const tabs = [
    { id: 'all', label: 'All Offers', count: myOffers.length },
    { id: 'pending', label: 'Pending', count: myOffers.filter(o => o.status === 'pending').length },
    { id: 'accepted', label: 'Accepted', count: myOffers.filter(o => o.status === 'accepted').length },
    { id: 'rejected', label: 'Rejected', count: myOffers.filter(o => o.status === 'rejected').length },
    { id: 'withdrawn', label: 'Withdrawn', count: myOffers.filter(o => o.status === 'withdrawn').length },
    { id: 'expired', label: 'Expired', count: myOffers.filter(o => o.status === 'expired').length },
  ];

  const filteredOffers = myOffers
    .filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchPart = o.partName.toLowerCase().includes(query);
        const matchShop = o.sellerShop.toLowerCase().includes(query);
        const matchBrand = o.partBrand.toLowerCase().includes(query);
        return matchPart || matchShop || matchBrand;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return offerTotal(a) - offerTotal(b);
      if (sortBy === 'price_desc') return offerTotal(b) - offerTotal(a);
      if (sortBy === 'rating') return b.sellerRating - a.sellerRating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const toggleCompare = (offer: Offer) => {
    if (comparingOffers.some(o => o.id === offer.id)) {
      setComparingOffers(comparingOffers.filter(o => o.id !== offer.id));
    } else {
      if (comparingOffers.length >= 3) {
        alert('You can compare a maximum of 3 offers at a time.');
        return;
      }
      setComparingOffers([...comparingOffers, offer]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Received Offers</h1>
          <p className="text-sm text-text-secondary">
            Review quotes submitted by verified spare-part sellers. Compare pricing, warranties, and delivery options.
          </p>
        </div>

        {comparingOffers.length > 0 && (
          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="btn-accent flex items-center gap-2 self-start sm:self-auto shadow-md"
          >
            <Scale size={16} /> Compare ({comparingOffers.length}) Offers
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by part, brand, or seller..."
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-text-secondary flex items-center gap-1 font-medium">
            <ArrowUpDown size={14} /> Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="select-field !py-2 !w-auto text-xs"
          >
            <option value="newest">Most Recent</option>
            <option value="price_asc">Lowest Price First</option>
            <option value="price_desc">Highest Price First</option>
            <option value="rating">Top Rated Seller</option>
          </select>
        </div>
      </div>

      {/* Offers Grid */}
      {clientDataLoadState.offers === 'loading' ? <div className="card py-16 text-center text-sm text-text-secondary">Loading offers…</div> : clientDataLoadState.offers === 'error' ? <div role="alert" className="card border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800">{clientDataLoadErrors.offers || 'Offers could not be loaded.'} <button onClick={() => window.location.reload()} className="ml-2 underline font-semibold">Retry</button></div> : filteredOffers.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Tag size={24} />
          </div>
          <h3 className="text-sm font-bold text-navy-900">No offers found</h3>
          <p className="text-xs text-text-secondary mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOffers.map((offer) => {
            const isComparing = comparingOffers.some(o => o.id === offer.id);
            const parentReq = myRequests.find(r => r.id === offer.requestId) ?? offer.request;

            return (
              <div
                key={offer.id}
                className={`card p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  isComparing ? 'ring-2 ring-accent' : ''
                }`}
              >
                <div>
                  {/* Target Request pill */}
                  {parentReq && (
                    <div className="mb-3 pb-2 border-b border-border flex items-center justify-between text-[11px] text-text-tertiary">
                      <span className="font-semibold text-text-secondary truncate">
                        For: {parentReq.vehicle?.brand ?? ''} {parentReq.vehicle?.model ?? ''}
                      </span>
                      <span className="font-mono">#{offer.requestId}</span>
                    </div>
                  )}

                  {/* Seller Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={offer.sellerShop} size="sm" />
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-navy-900">{offer.sellerShop}</p>
                          {offer.sellerVerified && <VerifiedBadge />}
                        </div>
                        <Rating rating={offer.sellerRating} reviews={offer.sellerReviews} size={11} />
                      </div>
                    </div>
                    <StatusBadge status={offer.status} />
                  </div>
                  {offer.status === 'accepted' && offer.orderStatus === 'cancelled' && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">The linked order was cancelled.</p>}

                  {/* Part & Price */}
                  <div className="mt-4">
                    <h3 className="text-base font-bold text-navy-900">{offer.partName}</h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-navy-900">
                        {formatCurrency(offerTotal(offer))}
                      </span>
                      <span className="text-xs text-text-secondary">total for {offer.quantity} item{offer.quantity === 1 ? '' : 's'}</span>
                      {offer.deliveryCost > 0 ? (
                        <span className="text-xs text-text-secondary">
                          + {offer.deliveryCost} TND delivery
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-primary">
                          Free Delivery
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges specifications */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-surface-secondary text-text-secondary font-medium">
                      Brand: {offer.partBrand}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-secondary text-text-secondary font-medium capitalize">
                      {offer.condition}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold">
                      {offer.warranty}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                      {offer.availability}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mt-3 line-clamp-2">
                    {offer.description}
                  </p>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCompare(offer)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                      isComparing
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-text-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    <Scale size={13} /> {isComparing ? 'Comparing' : 'Compare'}
                  </button>

                  <button
                    onClick={() => navigate(`/client/offers/${offer.id}`)}
                    className="btn-accent text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    View Details <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare Modal */}
      <Modal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        title={`Comparing ${comparingOffers.length} Offers`}
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-3 text-text-tertiary uppercase font-bold w-32">Metric</th>
                {comparingOffers.map((o) => (
                  <th key={o.id} className="py-3 px-3 min-w-[200px] text-navy-900 font-bold">
                    <div className="flex items-center justify-between">
                      <span>{o.sellerShop}</span>
                      <button onClick={() => toggleCompare(o)} className="text-text-tertiary hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Part Name</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 font-bold text-navy-900">{o.partName}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Brand & Ref</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3">{o.partBrand} ({o.referenceNumber || 'N/A'})</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Unit Price</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 font-extrabold text-navy-900 text-sm">
                    {formatCurrency(o.price)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Quantity</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3">{o.quantity}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Delivery Cost</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 font-semibold">
                    {o.deliveryCost === 0 ? 'Free Delivery' : `${o.deliveryCost} TND (${o.deliveryTime})`}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Total Quote</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 font-extrabold text-navy-900">{formatCurrency(offerTotal(o))}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Condition</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 capitalize font-medium">{o.condition}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Warranty</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3 text-green-700 font-bold">{o.warranty}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-text-secondary">Seller Rating</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-2.5 px-3">
                    <Rating rating={o.sellerRating} reviews={o.sellerReviews} size={11} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-text-secondary">Action</td>
                {comparingOffers.map((o) => (
                  <td key={o.id} className="py-3 px-3">
                    <button
                      onClick={() => {
                        setIsCompareModalOpen(false);
                        navigate(`/client/offers/${o.id}`);
                      }}
                      className="btn-accent text-xs py-1.5 px-3 w-full"
                    >
                      View & Accept
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};

export default ClientOffers;

