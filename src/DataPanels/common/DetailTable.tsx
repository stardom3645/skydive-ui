import * as React from 'react'
import { Table } from 'antd'
import { TableProps } from 'antd/lib/table'

export interface DetailTableProps<RecordType extends object> extends TableProps<RecordType> {
    className?: string
}

/**
 * Mold-aligned Ant Design table used inside detail panels.
 *
 * Keeping the compact size, fixed layout and pagination defaults here prevents
 * feature tables from recreating subtly different Ant table shells.
 */
export const DetailTable = <RecordType extends object>({
    className,
    pagination,
    size,
    tableLayout,
    ...props
}: DetailTableProps<RecordType>) => <Table<RecordType>
    {...props}
    className={`netdive-detail-table${className ? ` ${className}` : ''}`}
    pagination={pagination === undefined ? false : pagination}
    size={size || 'small'}
    tableLayout={tableLayout || 'fixed'} />

export default DetailTable
