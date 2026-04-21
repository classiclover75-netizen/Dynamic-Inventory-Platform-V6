import React, { useMemo } from 'react';
import { Modal, Button } from './ui';
import { RowData, Column } from '../types';
import { Trash2 } from 'lucide-react';

interface DuplicateFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  rows: RowData[];
  columns: Column[];
  onDeleteRow: (rowId: string) => void;
}

export const DuplicateFinderModal: React.FC<DuplicateFinderModalProps> = ({
  isOpen,
  onClose,
  onBack,
  rows,
  columns,
  onDeleteRow,
}) => {
  // Find duplicates by comparing all data values in a row (excluding system keys)
  const duplicateGroups = useMemo(() => {
    if (!isOpen || !rows || rows.length === 0) return [];

    const groups: Record<string, RowData[]> = {};

    // Determine which columns to compare (exclude system keys and images)
    const columnsToCompare = columns.filter(
      (col) => !['id', '_id', 'sr', 'images'].includes(col.key) && col.type !== 'image'
    );

    rows.forEach((row) => {
      // Create a normalized string representation of the row's data for comparison
      const rowValues = columnsToCompare.map((col) => {
        const val = row[col.key];
        if (Array.isArray(val)) {
          return val.map(v => String(v || '').trim()).join('|');
        }
        return String(val || '').trim().toLowerCase();
      });

      const hash = rowValues.join('|||');

      if (!groups[hash]) {
        groups[hash] = [];
      }
      groups[hash].push(row);
    });

    // Filter out groups that only have 1 item (no duplicates)
    return Object.values(groups).filter((group) => group.length > 1);
  }, [isOpen, rows, columns]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} onBack={onBack} title="🔍 Find Duplicates" width="800px">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 m-0">
          This tool precisely identifies identical rows based on all text and data columns. You can manually delete the duplicates below.
        </p>

        {duplicateGroups.length === 0 ? (
          <div className="bg-green-50 text-green-700 p-4 rounded border border-green-200 text-center font-medium">
            No duplicates found on this page! 🎉
          </div>
        ) : (
          <div className="flex flex-col gap-6 overflow-auto max-h-[60vh] pr-2">
            {duplicateGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="border border-orange-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-orange-50 px-3 py-2 border-b border-orange-200 flex justify-between items-center">
                  <span className="font-bold text-orange-800 text-sm">
                    Duplicate Group {groupIndex + 1} ({group.length} identical rows)
                  </span>
                </div>
                <div className="bg-white">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {columns
                          .filter((c) => !['id', '_id', 'sr', 'images'].includes(c.key) && c.type !== 'image')
                          .map((col) => (
                            <th key={col.key} className="text-left p-2 font-semibold text-gray-600 border-r border-gray-200 last:border-r-0">
                              {col.name}
                            </th>
                          ))}
                        <th className="w-[80px] text-center p-2 font-semibold text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((row, rowIndex) => (
                        <tr key={row.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                          {columns
                            .filter((c) => !['id', '_id', 'sr', 'images'].includes(c.key) && c.type !== 'image')
                            .map((col) => {
                              const val = row[col.key];
                              const displayVal = Array.isArray(val) ? val.join(', ') : String(val || '');
                              return (
                                <td key={col.key} className="p-2 border-r border-gray-100 last:border-r-0 truncate max-w-[150px]" title={displayVal}>
                                  {displayVal}
                                </td>
                              );
                            })}
                          <td className="p-2 text-center">
                            <Button
                              variant="red"
                              onClick={() => onDeleteRow(row.id)}
                              className="px-2 py-1"
                              title="Delete this duplicate"
                            >
                              <Trash2 size={14} /> Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
