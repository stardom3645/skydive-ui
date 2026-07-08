/*
 * Copyright (C) 2019 Sylvain Afchain
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { createStyles, Theme } from '@material-ui/core'

export const styles = (theme: Theme) => createStyles({
  panelCard: {
    border: '1px solid #f0f0f0 !important',
    borderRadius: '10px !important',
    background: '#ffffff !important',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(16, 24, 40, 0.035) !important',
    color: 'var(--netdive-detail-text)',
    '&:before': {
      display: 'none'
    },
    '&.Mui-expanded': {
      margin: '0 !important'
    }
  },
  panelHeader: {
    minHeight: '44px !important',
    padding: '0 16px !important',
    borderBottom: '1px solid #f0f0f0',
    background: '#ffffff',
    '&.Mui-expanded': {
      minHeight: '44px !important'
    },
    '& .MuiAccordionSummary-content': {
      margin: '0 !important',
      minWidth: 0
    },
    '& .MuiAccordionSummary-expandIcon': {
      color: 'var(--netdive-detail-muted, #64748b)'
    }
  },
  panelHeaderMain: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0
  },
  panelTitle: {
    color: '#101828',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  panelBody: {
    padding: '10px 14px 14px !important',
    background: '#ffffff',
    minWidth: 0,
    overflowX: 'auto'
  },
  panelIconFree: {
    fontFamily: `"Font Awesome 5 Free" !important`,
    fontWeight: 900,
    fontSize: 18,
    marginBottom: `0 !important`,
    paddingRight: 8,
    color: 'var(--netdive-detail-accent)'
  },
  panelIconBrands: {
    fontFamily: `"Font Awesome 5 Brands" !important`,
    fontWeight: 900,
    fontSize: 18,
    marginBottom: `0 !important`,
    paddingRight: 8,
    color: 'var(--netdive-detail-accent)'
  }
})
