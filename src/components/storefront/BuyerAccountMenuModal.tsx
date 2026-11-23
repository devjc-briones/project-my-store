import React, { useState } from 'react';
import { Package, Mail, LogOut, Clock, X, ShieldCheck, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CurrencyCode, OrderFulfillmentStatus, Roles, Store } from '../../types/schema';
import { formatCurrency } from '../../utils/pricing';

interface BuyerAccountMenuModalProps {
  isOpen: boolean;
  store: Store;
  currency: string;
  onClose: () => void;
  onOpenTracking: (orderId: string) => void;
  onOpenInfoSettings?: () => void;
}

const STEPS: OrderFulfillmentStatus[] = ['Pending', 'Preparing', 'Out for Delivery', 'Completed'];

function getStepIndex(status: OrderFulfillmentStatus): number {
  const idx = STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function BuyerAccountMenuModal({
  isOpen,
  store,
  currency,
  onClose,
  onOpenTracking,
  onOpenInfoSettings,
}: BuyerAccountMenuModalProps) {
  useBodyScrollLock(isOpen);
  const { state, buyerSignOut, getBuyerOrders, getBuyerCheckoutInfo, pushToast } = useStore();

  const buyer = state.currentBuyer;
  const buyerOrders = getBuyerOrders();
  const savedCheckoutInfo = getBuyerCheckoutInfo();

  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('orders');

  if (!isOpen || !buyer) return null;

  const handleSignOut = () => {
    buyerSignOut();
    pushToast({
      type: 'info',
      title: 'Signed out',
      description: 'Your session has been signed out.',
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account & Order History"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {buyer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{buyer.name}</h2>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{buyer.email}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex px-6 pt-4 gap-2 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'orders'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            My Orders ({buyerOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Account Details
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'orders' ? (
            buyerOrders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No orders placed yet</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Explore items in {store.name} and complete your first checkout to track orders in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {buyerOrders.map((order) => {
                  const stepIdx = getStepIndex(order.status);
                  return (
                    <div
                      key={order.id}
                      className="border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs space-y-3 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            #{order.id}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {order.storeName ?? store.name}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3" />
                          {order.status}
                        </span>
                      </div>

                      {/* 4-Step Live Tracking Progress */}
                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {STEPS.map((stepName, i) => {
                          const isDone = i <= stepIdx;
                          return (
                            <div key={stepName} className="space-y-1">
                              <div
                                className={`h-1.5 rounded-full transition-colors ${
                                  isDone ? 'bg-blue-600' : 'bg-slate-200'
                                }`}
                              />
                              <p
                                className={`text-[10px] font-medium truncate ${
                                  isDone ? 'text-slate-900 font-semibold' : 'text-slate-400'
                                }`}
                              >
                                {stepName}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {order.items.length} item{order.items.length > 1 ? 's' : ''} ·{' '}
                          <strong className="text-slate-900">
                            {formatCurrency(order.grandTotal, currency as CurrencyCode)}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenTracking(order.id);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          <span>Live Tracking</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs gap-3">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-900 truncate">{buyer.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs gap-3">
                  <span className="text-slate-500">Email Address</span>
                  <span className="font-semibold text-slate-900 truncate">{buyer.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs gap-3">
                  <span className="text-slate-500">Role</span>
                  <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                    {buyer.role ?? Roles.Buyer}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs gap-3">
                  <span className="text-slate-500">Account Created</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(buyer.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {onOpenInfoSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInfoSettings();
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left flex items-center justify-between gap-3 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">Information Settings</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {savedCheckoutInfo
                          ? `${savedCheckoutInfo.fullName} · ${savedCheckoutInfo.phoneNumber}`
                          : 'Set saved delivery details for checkout auto-fill'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Secure Persistent Session
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-slate-900 hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
