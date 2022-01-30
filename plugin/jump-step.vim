if !exists('g:jump_step_labels')
  let g:jump_step_labels = [
  \ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  \ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  \ '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '\', '`', '[', ']', ';', "'", ',', '.', '/',
  \ '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
  \ ]
endif

if !exists('g:jump_step_word_regexp_list')
  let g:jump_step_word_regexp_list = ['[0-9a-zA-Z_-]+', '([0-9a-zA-Z_-]|[.])+', '([0-9a-zA-Z_-]|[().#])+']
endif

if !exists('g:jump_step_word_filter_regexp_list')
  let g:jump_step_word_filter_regexp_list = ['^[a-zA-Z0-0]']
endif

function! s:initialize_highlight() abort
  highlight default JumpStepShade   ctermfg=grey ctermbg=NONE cterm=NONE           guibg=NONE    guifg=#777777 gui=NONE
  highlight default JumpStepChar    ctermfg=209  ctermbg=NONE cterm=underline,bold guifg=#E27878 guibg=NONE    gui=underline,bold
endfunction

augroup JumpStep
  autocmd!
  autocmd ColorScheme * call s:initialize_highlight()
augroup END

call s:initialize_highlight()
