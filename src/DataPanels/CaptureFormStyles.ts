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

import { createStyles, Theme } from '@material-ui/core/styles'

export const styles = (theme: Theme) => createStyles({
    textField: {
        marginLeft: 0,
        marginRight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
    },
    button: {
        margin: theme.spacing(1),
    },
    control: {
        display: "block !important",
        "& .MuiInputBase-root": {
            display: "block !important",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box"
        },
        "& .MuiSelect-root, & .MuiInputBase-input, & textarea, & input": {
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            paddingLeft: "5px"
        },
        marginTop: 36,
        marginLeft: 0,
        marginRight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
    },
    advanced: {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: "unset !important",
        '&::before': {
            top: 0,
            height: 0
        }
    },
    advancedSummary: {
        padding: 0,
        marginLeft: 8,
        marginRight: 8,
        color: "var(--netdive-detail-text)",
        backgroundColor: "unset !important",
        borderColor: "unset",
        '& .MuiAccordionSummary-content': {
            backgroundColor: "unset",
        }
    }
})
