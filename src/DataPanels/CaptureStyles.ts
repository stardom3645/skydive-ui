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

import { createStyles, Theme } from '@material-ui/core';

export const styles = (theme: Theme) => createStyles({
  dialogRoot: {
    '& .ant-modal-content': {
      overflow: 'hidden',
      border: '1px solid var(--netdive-detail-card-border)',
      borderRadius: 'var(--netdive-ops-radius)',
      background: 'var(--netdive-ant-bg)',
      boxShadow: 'var(--netdive-ant-popup-shadow)'
    },
    '& .ant-modal-header': {
      minHeight: 52,
      padding: theme.spacing(1.75, 2),
      borderBottom: '1px solid var(--netdive-detail-section-divider)',
      background: 'var(--netdive-ant-bg)'
    },
    '& .ant-modal-title': {
      color: 'var(--netdive-detail-text)',
      fontSize: 'var(--netdive-detail-font-panel-title)',
      fontWeight: 'var(--netdive-detail-weight-panel-title)',
      lineHeight: 'var(--netdive-detail-line-panel-title)'
    },
    '& .ant-modal-close': { top: 4, right: 4, color: 'var(--netdive-detail-text-tertiary)' },
    '& .ant-modal-close-x': { width: 44, height: 44, lineHeight: '44px' },
    '& .ant-modal-body': {
      maxHeight: 'calc(100vh - 148px)',
      overflowY: 'auto',
      padding: 'var(--netdive-ops-panel-padding)',
      background: 'var(--netdive-ops-neutral)'
    }
  },
  dialogTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& svg': { color: 'var(--netdive-ant-primary)', fontSize: 18 }
  }
})
