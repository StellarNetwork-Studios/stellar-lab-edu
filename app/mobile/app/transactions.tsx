import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import TransactionItem from '../components/transaction-item';
import { useTransactions } from '../hooks/use-transactions';
import useOffline from '../hooks/useOffline';
import { getCache, saveCache } from '../services/cache';
import type { TransactionItem as TransactionItemType } from '../types/transaction';
import { ErrorState } from '../components/resilience/error-state';
import { EmptyState } from '../components/resilience/empty-state';

const DEMO_ACCOUNT_ID =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

const STATUS_FILTERS = ['All', 'Success', 'Pending'] as const;

function getAssetCode(asset: string): string {
  const colonIdx = asset.indexOf(':');
  return colonIdx === -1 ? asset : asset.slice(0, colonIdx);
}

function parseDateInput(value: string, endOfDay: boolean): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date.getTime();
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function SkeletonRow() {
  return (
    <View style={skeleton.row}>
      <View style={skeleton.circle} />
      <View style={skeleton.lines}>
        <View style={[skeleton.line, { width: '55%' }]} />
        <View style={[skeleton.line, { width: '35%', marginTop: 6 }]} />
      </View>
      <View style={[skeleton.line, { width: 60, alignSelf: 'center' }]} />
    </View>
  );
}

const skeleton = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    marginRight: 14,
  },
  lines: {
    flex: 1,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
});

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = (params.accountId ?? DEMO_ACCOUNT_ID).trim();

  const isOffline = useOffline();
  const [cachedTransactions, setCachedTransactions] = React.useState<TransactionItemType[]>([]);

  const {
    transactions,
    loading,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useTransactions(accountId);

  const [searchQuery, setSearchQuery] = React.useState('');
  const deferredQuery = React.useDeferredValue(searchQuery);
  const [assetFilter, setAssetFilter] = React.useState<string>('All');
  const [statusFilter, setStatusFilter] =
    React.useState<(typeof STATUS_FILTERS)[number]>('All');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  React.useEffect(() => {
    const loadCachedTransactions = async () => {
      if (!isOffline) return;

      const cached = await getCache('transactions');
      if (Array.isArray(cached)) {
        setCachedTransactions(cached as TransactionItemType[]);
      } else {
        setCachedTransactions([]);
      }
    };

    loadCachedTransactions();
  }, [isOffline]);

  React.useEffect(() => {
    const persistTransactions = async () => {
      if (isOffline) return;
      if (transactions.length === 0) return;
      await saveCache('transactions', transactions);
    };

    persistTransactions();
  }, [transactions, isOffline]);

  const dataSource = isOffline ? cachedTransactions : transactions;

  const assetOptions = React.useMemo(() => {
    const codes = new Set<string>();
    dataSource.forEach((item) => codes.add(getAssetCode(item.asset)));
    return ['All', ...Array.from(codes).sort()];
  }, [dataSource]);

  const fromMs = React.useMemo(() => parseDateInput(dateFrom, false), [dateFrom]);
  const toMs = React.useMemo(() => parseDateInput(dateTo, true), [dateTo]);

  const filteredTransactions = React.useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();

    return dataSource.filter((item) => {
      if (assetFilter !== 'All' && getAssetCode(item.asset) !== assetFilter) {
        return false;
      }

      const itemStatus = item.status ?? 'Success';
      if (statusFilter !== 'All' && itemStatus !== statusFilter) {
        return false;
      }

      const timestampMs = Date.parse(item.timestamp);
      if (fromMs !== null && !Number.isNaN(timestampMs) && timestampMs < fromMs) {
        return false;
      }
      if (toMs !== null && !Number.isNaN(timestampMs) && timestampMs > toMs) {
        return false;
      }

      if (!query) return true;

      const memo = (item.memo ?? '').toLowerCase();
      const source = (item.source ?? '').toLowerCase();
      const destination = (item.destination ?? '').toLowerCase();
      const hash = item.txHash.toLowerCase();
      const asset = getAssetCode(item.asset).toLowerCase();

      return (
        memo.includes(query) ||
        source.includes(query) ||
        destination.includes(query) ||
        hash.includes(query) ||
        asset.includes(query)
      );
    });
  }, [dataSource, deferredQuery, assetFilter, statusFilter, fromMs, toMs]);

  const filtersActive =
    searchQuery.trim().length > 0 ||
    assetFilter !== 'All' ||
    statusFilter !== 'All' ||
    dateFrom.trim().length > 0 ||
    dateTo.trim().length > 0;

  const shortAccount = `${accountId.slice(0, 6)}…${accountId.slice(-4)}`;

  const handleExport = React.useCallback(async () => {
    if (isOffline) {
      Alert.alert(
        'Offline mode',
        'Export is disabled while offline. Please reconnect and try again.'
      );
      return;
    }

    if (filteredTransactions.length === 0) {
      Alert.alert('Nothing to export', 'There are no transactions matching your filters.');
      return;
    }

    const headers = [
      'timestamp',
      'amount',
      'asset',
      'memo',
      'txHash',
      'pagingToken',
      'source',
      'destination',
      'status',
    ];

    const rows = filteredTransactions.map((item) => [
      item.timestamp,
      item.amount,
      item.asset,
      item.memo ?? '',
      item.txHash,
      item.pagingToken,
      item.source ?? '',
      item.destination ?? '',
      item.status ?? 'Success',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(String(cell))).join(','))
      .join('\n');

    try {
      const fileName = `quickex-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      const baseUri =
        FileSystem.Paths?.cache?.uri ?? FileSystem.Paths?.document?.uri ?? '';
      const normalizedBaseUri = baseUri.endsWith('/') ? baseUri : `${baseUri}/`;
      const fileUri = `${normalizedBaseUri}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8' as any,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Transactions',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to export CSV.';
      Alert.alert('Export failed', message);
    }
  }, [filteredTransactions, isOffline]);

  const handleClearFilters = React.useCallback(() => {
    setSearchQuery('');
    setAssetFilter('All');
    setStatusFilter('All');
    setDateFrom('');
    setDateTo('');
  }, []);

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.headerRow}>
        <Text style={styles.accountPill}>{shortAccount}</Text>
        <Text style={styles.countLabel}>
          {filteredTransactions.length} of {dataSource.length}
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search memo, address, or hash"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Asset Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {assetOptions.map((option) => {
              const active = option === assetFilter;
              return (
                <Pressable
                  key={option}
                  onPress={() => setAssetFilter(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((option) => {
            const active = option === statusFilter;
            return (
              <Pressable
                key={option}
                onPress={() => setStatusFilter(option)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Date Range</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>From</Text>
            <TextInput
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              style={styles.dateInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.dateInputWrap}>
            <Text style={styles.dateLabel}>To</Text>
            <TextInput
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              style={styles.dateInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {(dateFrom && fromMs === null) || (dateTo && toMs === null) ? (
          <Text style={styles.dateHint}>
            Use the format YYYY-MM-DD (e.g. 2026-03-01).
          </Text>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        {filtersActive ? (
          <Pressable onPress={handleClearFilters} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Clear Filters</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <View style={styles.exportWrap}>
          <Pressable
            onPress={handleExport}
            style={[styles.exportButton, isOffline && styles.exportButtonDisabled]}
            disabled={isOffline}
          >
            <Text style={styles.exportButtonText}>Export to CSV</Text>
          </Pressable>

          {isOffline ? (
            <Text style={styles.offlineHint}>Offline mode: export disabled</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  const listEmpty = loading && !isOffline ? (
    <View>
      {[...Array(6)].map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  ) : error && !isOffline ? (
    <ErrorState message={error} onRetry={refresh} />
  ) : filtersActive ? (
    <EmptyState
      title="No matching transactions"
      message="Try adjusting your filters or search terms."
      icon="filter-outline"
    />
  ) : (
    <EmptyState
      title="No transactions yet"
      message="Payments sent or received to this account will appear here."
      icon="receipt-outline"
    />
  );

  const listFooter = hasMore && !isOffline ? (
    <View style={styles.footer}>
      <ActivityIndicator size="small" color="#6B7280" />
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            You are offline. Showing cached data.
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.backBtn} />
      </View>

      <FlashList<TransactionItemType>
        data={filteredTransactions}
        keyExtractor={(item) => item.pagingToken}
        renderItem={({ item }) => <TransactionItem item={item} accountId={accountId} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={isOffline ? false : refreshing}
            onRefresh={refresh}
            enabled={!isOffline}
            tintColor="#6B7280"
          />
        }
        onEndReached={isOffline ? undefined : loadMore}
        onEndReachedThreshold={0.8}
        estimatedItemSize={88}
        contentContainerStyle={
          (filteredTransactions.length === 0 || (error && !isOffline)) && !loading
            ? { paddingBottom: 24 }
            : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  offlineBannerText: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backChevron: {
    fontSize: 28,
    color: '#111827',
    lineHeight: 32,
  },

  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
    fontFamily: 'monospace',
  },
  countLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchWrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    fontSize: 14,
    color: '#111827',
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputWrap: {
    flex: 1,
    gap: 6,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  dateInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  dateHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  ghostButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ghostButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  exportWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  exportButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineHint: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },

  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});