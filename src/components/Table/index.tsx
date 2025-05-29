import { useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faChevronUp,
  faChevronDown,
  faUserCircle,
  faCrown,
} from '@fortawesome/free-solid-svg-icons';

import styles from './table.module.css';

import type { MouseEvent } from 'react';

type TableProps = {
  data: Record<string, any>[];
};

type SortDir = 'asc' | 'desc' | null;

const formatHeader = (header: string) => {
  const words = header.split(/(?=[A-Z])/);
  return words
    .map((w, idx) =>
      idx === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.toLowerCase(),
    )
    .join(' ');
};

export default function Table({ data }: TableProps) {
  if (!data.length) return null;

  const hasNavigate = data.some((row) => typeof row.navigate === 'string');
  const headers = Object.keys(data[0]).filter(
    (h) => h !== 'navigate' && h !== 'playerSlug' && h !== 'playerImage',
  );

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const sortedData = useMemo(() => {
    if (!sortField || !sortDir) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDir === 'asc' ? -1 : 1;
      if (bVal == null) return sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDir]);

  const onHeaderClick = (field: string) => (e: MouseEvent) => {
    e.preventDefault();
    if (sortField !== field) {
      setSortField(field);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else {
      setSortField(null);
      setSortDir(null);
    }
  };

  return (
    <div className={styles.tableContainer}>
      <LayoutGroup>
        <table className={styles.table}>
          <thead>
            <tr>
              {headers.map((field) => {
                const fullText = formatHeader(field); // e.g. "Number Of Players" or "Date"
                const isNumberOf = fullText
                  .toLowerCase()
                  .startsWith('number of ');
                // if it’s a “Number Of …” header, change to “No. …”, otherwise just repeat the full text
                const shortText = isNumberOf
                  ? 'No. ' + fullText.slice('Number Of '.length)
                  : fullText;

                return (
                  <th
                    key={field}
                    data-field={field}
                    onClick={onHeaderClick(field)}
                  >
                    <div>
                      {/* desktop: show this */}
                      <span className={styles.longLabel}>{fullText}</span>
                      {/* mobile: show this (falls back to fullText when not a Number Of…) */}
                      <span className={styles.shortLabel}>{shortText}</span>

                      <FontAwesomeIcon
                        icon={
                          sortField === field
                            ? sortDir === 'desc'
                              ? faChevronDown
                              : faChevronUp
                            : faChevronDown
                        }
                        className={styles.sortIcon}
                        style={{
                          visibility:
                            sortField === field ? 'visible' : 'hidden',
                        }}
                      />
                    </div>
                  </th>
                );
              })}

              {hasNavigate && <th aria-label="Actions" />}
            </tr>
          </thead>

          <motion.tbody layout>
            <AnimatePresence>
              {sortedData.map((row, i) => {
                const nav =
                  hasNavigate && typeof row.navigate === 'string'
                    ? row.navigate
                    : null;

                return (
                  <motion.tr
                    key={nav ?? i}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={nav ? styles.clickableRow : undefined}
                    onClick={
                      nav ? () => (window.location.href = nav) : undefined
                    }
                  >
                    {headers.map((header) => {
                      if (header === 'place' || header === 'position') {
                        return (
                          <td key={header} className={styles.placeCell}>
                            <span
                              style={
                                row.place === '1st' || row.position === '1st'
                                  ? { color: '#dfbc00', fontWeight: 'bold' }
                                  : row.place === '2nd' ||
                                      row.position === '2nd'
                                    ? { color: '#aeacac', fontWeight: 'bold' }
                                    : row.place === '3rd' ||
                                        row.position === '3rd'
                                      ? { color: '#CD7F32', fontWeight: 'bold' }
                                      : { color: '#757575' }
                              }
                            >
                              {row.place || row.position}
                            </span>
                          </td>
                        );
                      }

                      if (['winner', 'leader', 'name'].includes(header)) {
                        const playerName = row.winner || row.leader || row.name;
                        const playerPath = `/players/${row.playerSlug}`;

                        return (
                          <td key={header}>
                            <div className={styles.playerCellInner}>
                              <a
                                href={playerPath}
                                style={{
                                  all: 'unset',
                                  cursor: 'pointer',
                                  position: 'relative',
                                }}
                              >
                                {row.place === '1st' && (
                                  <FontAwesomeIcon
                                    icon={faCrown}
                                    className={styles.crownIcon}
                                    color="#FFD700"
                                  />
                                )}
                                {row.playerImage ? (
                                  <img
                                    src={row.playerImage}
                                    alt={playerName}
                                    className={styles.playerImage}
                                  />
                                ) : (
                                  <FontAwesomeIcon
                                    icon={faUserCircle}
                                    className={styles.avatarIcon}
                                  />
                                )}
                              </a>
                              <a className={styles.link} href={playerPath}>
                                {playerName}
                              </a>
                            </div>
                          </td>
                        );
                      }
                      return <td key={header}>{row[header]}</td>;
                    })}

                    {hasNavigate && (
                      <td className={styles.chevronCell}>
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className={styles.chevron}
                        />
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </LayoutGroup>
    </div>
  );
}
