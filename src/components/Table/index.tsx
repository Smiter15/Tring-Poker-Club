import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faChevronUp,
  faChevronDown,
  faUserCircle,
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

const Table = ({ data }: TableProps) => {
  if (!data.length) return null;

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
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((field) => (
              <th
                key={field}
                onClick={onHeaderClick(field)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div>
                  <span>{formatHeader(field)}</span>
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
                      visibility: sortField === field ? 'visible' : 'hidden',
                    }}
                  />
                </div>
              </th>
            ))}
            <th aria-label="Actions" />
          </tr>
        </thead>

        <tbody>
          {sortedData.map((row, i) => (
            <tr
              key={row.navigate ?? i}
              className={styles.clickableRow}
              onClick={() => (window.location.href = row.navigate)}
            >
              {headers.map((header) => {
                if (
                  header === 'winner' ||
                  header === 'leader' ||
                  header === 'name'
                ) {
                  const playerName = row.winner || row.leader || row.name;
                  const playerPath = `/players/${row.playerSlug}`;
                  return (
                    <td key={header} className={styles.playerCell}>
                      <a href={playerPath} style={{ all: 'unset' }}>
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
                    </td>
                  );
                }
                return <td key={header}>{row[header]}</td>;
              })}
              <td className={styles.chevronCell}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={styles.chevron}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
