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

import { createStyles, makeStyles, Theme } from '@material-ui/core'

export const styles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      height: 250,
    },
    container: {
      flexGrow: 1,
      position: 'relative',
    },
    paper: {
      position: 'absolute',
      zIndex: 3,
      marginTop: theme.spacing(1),
      left: 0,
      right: 0,
      borderRadius: 10,
      border: '1px solid var(--netdive-search-border)',
      backgroundColor: 'var(--netdive-detail-bg)',
      color: 'var(--netdive-detail-text)',
      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)'
    },
    chip: {
      margin: theme.spacing(0.5, 0.25),
    },
    inputRoot: {
      flexWrap: 'wrap',
      color: 'var(--netdive-search-muted)',
      minHeight: 34,
      paddingLeft: theme.spacing(1)
    },
    inputInput: {
      transition: theme.transitions.create('width'),
      width: '100%',
      fontSize: 14,
      color: 'var(--netdive-search-text)',
      [theme.breakpoints.up('md')]: {
        width: 220,
      },
    }
  })
)
